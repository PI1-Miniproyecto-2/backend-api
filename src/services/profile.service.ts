import type { UserProfile, ProfileResponse } from '../models/user-profile';
import { Timestamp } from 'firebase-admin/firestore';
import { DEFAULT_AVATAR } from '../config/avatars';
import type { VerifiedIdentity } from './auth.service';
import { ApiError, infrastructureError } from './api-error';
import { createProfileStore, type ProfileStore, type ProfileTransaction } from './profile.store';
import { validateProfileInput } from './profile.validation';

const inconsistent = () => new ApiError(409, 'Perfil o reserva inconsistente; requiere reconciliación');

function inspectProfile(data: Record<string, unknown>): asserts data is Record<string, unknown> & UserProfile {
  const fields = ['firstName', 'lastName', 'username', 'usernameNormalized', 'email', 'avatarId', 'authProvider', 'profileCompleted', 'createdAt', 'updatedAt'];
  if (Object.keys(data).length !== fields.length || fields.some(key => !Object.hasOwn(data, key))) throw inconsistent();
  for (const key of ['firstName', 'lastName']) {
    if (typeof data[key] === 'string' && data[key] !== data[key].trim()) throw inconsistent();
  }
  try {
    validateProfileInput(Object.fromEntries(['firstName', 'lastName', 'username', 'avatarId'].map(k => [k, data[k]])));
  } catch { throw inconsistent(); }
  const normalized = typeof data.username === 'string' ? data.username.toLowerCase() : null;
  const completed = Boolean(data.firstName && data.lastName && data.username);
  if (data.usernameNormalized !== normalized || data.profileCompleted !== completed ||
      typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !['password', 'google.com'].includes(String(data.authProvider)) ||
      !(data.createdAt instanceof Timestamp) || !(data.updatedAt instanceof Timestamp)) throw inconsistent();
}

async function checkReservations(tx: ProfileTransaction, uid: string, profile: Record<string, unknown> | undefined) {
  const owned = await tx.reservations(uid);
  const expected = profile?.usernameNormalized ? `usernames/${profile.usernameNormalized}` : undefined;
  if (owned.length !== (expected ? 1 : 0) || (expected && owned[0] !== expected)) throw inconsistent();
  if (expected && (await tx.read(expected))?.uid !== uid) throw inconsistent();
}

export function createProfileService(store: ProfileStore = createProfileStore()) {
  async function run<T>(fn: (tx: ProfileTransaction) => Promise<T>): Promise<T> {
    try { return await store.transaction(fn); } catch (error) { infrastructureError(error); }
  }
  async function read(identity: VerifiedIdentity) {
    return run(async tx => {
      const profile = await tx.read(`users/${identity.uid}`);
      if (!profile) throw new ApiError(404, 'Perfil no encontrado');
      inspectProfile(profile);
      await checkReservations(tx, identity.uid, profile);
      return serialize(profile);
    });
  }
  async function write(identity: VerifiedIdentity, body: unknown, create: boolean) {
    const input = validateProfileInput(body);
    if (!identity.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) throw new ApiError(400, 'El token debe contener un correo válido');
    await run(async tx => {
      const path = `users/${identity.uid}`;
      const previous = await tx.read(path);
      if (create && previous) throw new ApiError(409, 'El perfil ya existe');
      if (!create && !previous) throw new ApiError(404, 'Perfil no encontrado');
      if (previous) inspectProfile(previous);
      await checkReservations(tx, identity.uid, previous);
      if (previous?.username && input.username === null) throw new ApiError(400, 'No se puede limpiar el nombre de usuario');
      if (previous?.profileCompleted && (input.firstName === null || input.lastName === null)) throw new ApiError(400, 'No se puede vaciar un perfil completo');
      const profile: Record<string, unknown> = {
        firstName: null, lastName: null, username: null, avatarId: DEFAULT_AVATAR,
        ...previous, ...input,
        email: identity.email, authProvider: identity.provider,
        createdAt: previous?.createdAt ?? store.timestamp(), updatedAt: store.timestamp(),
      };
      const name = typeof profile.username === 'string' ? profile.username.toLowerCase() : null;
      const oldName = previous?.usernameNormalized;
      if (name && name !== oldName) {
        const reservation = await tx.read(`usernames/${name}`);
        if (reservation) throw reservation.uid === identity.uid ? inconsistent() : new ApiError(409, 'Nombre de usuario ocupado');
      }
      profile.usernameNormalized = name;
      profile.profileCompleted = Boolean(profile.firstName && profile.lastName && name);
      // A partir de aquí solo escrituras: no hay efectos externos en la transacción.
      if (name && name !== oldName) tx.set(`usernames/${name}`, { uid: identity.uid });
      if (oldName && oldName !== name) tx.delete(`usernames/${oldName}`);
      tx.set(path, profile);
    });
    return read(identity);
  }
  return {
    read,
    create: (identity: VerifiedIdentity, body: unknown) => write(identity, body, true),
    update: (identity: VerifiedIdentity, body: unknown) => write(identity, body, false),
    async remove(identity: VerifiedIdentity) {
      await run(async tx => {
        const path = `users/${identity.uid}`;
        const profile = await tx.read(path);
        if (profile) inspectProfile(profile);
        await checkReservations(tx, identity.uid, profile);
        if (profile?.usernameNormalized) tx.delete(`usernames/${profile.usernameNormalized}`);
        if (profile) tx.delete(path);
      });
    },
  };
}

function serialize(profile: UserProfile): ProfileResponse {
  return { ...profile, createdAt: (profile.createdAt as Timestamp).toDate().toISOString(), updatedAt: (profile.updatedAt as Timestamp).toDate().toISOString() };
}
export type ProfileService = ReturnType<typeof createProfileService>;
