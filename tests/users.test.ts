import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { createAuthService } from '../src/services/auth.service';
import { createProfileService } from '../src/services/profile.service';
import { createUsersRoutes } from '../src/routes/users.routes';
import { authenticate } from '../src/middlewares/auth.middleware';
import { requireCompleteProfile } from '../src/middlewares/profile.middleware';
import { errorHandler, notFound } from '../src/middlewares/error.middleware';
import { MemoryStore } from './helpers/memory-store';

const complete = { firstName: ' Ana ', lastName: 'Perez', username: 'Ana_01', avatarId: 'avatar_owl' };
function fixture(provider: 'password' | 'google.com' = 'google.com') {
  const store = new MemoryStore();
  const service = createProfileService(store);
  const calls: boolean[] = [];
  const verify = createAuthService(async (token, revoked) => {
    calls.push(revoked);
    if (['invalid', 'expired', 'revoked', 'disabled', 'deleted'].includes(token)) {
      throw { code: ({ invalid: 'auth/invalid-id-token', expired: 'auth/id-token-expired', revoked: 'auth/id-token-revoked', disabled: 'auth/user-disabled', deleted: 'auth/user-not-found' } as Record<string, string>)[token], message: 'SECRET' };
    }
    if (token === 'outage') throw { code: 14, message: 'SECRET' };
    return { uid: token, email: token === 'noemail' ? undefined : token === 'bademail' ? 'correo-invalido' : `${token}@example.com`, firebase: { sign_in_provider: token === 'unsupported' ? 'anonymous' : provider } } as DecodedIdToken;
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/users', createUsersRoutes(service, verify));
  app.get('/private', authenticate(verify), requireCompleteProfile(service), (_req, res) => res.json({ ok: true }));
  app.use(notFound); app.use(errorHandler);
  const me = '/api/v1/users/me';
  return { app, store, service, calls, me };
}
for (const token of ['invalid', 'expired', 'revoked', 'disabled', 'deleted']) {
  test(`Auth: token ${token} devuelve 401 sin filtrar detalles`, async () => {
    const f = fixture();
    const r = await request(f.app).get(f.me).auth(token, { type: 'bearer' }).expect(401);
    assert.deepEqual(r.body, { error: 'Token inválido, expirado o revocado' });
    assert.deepEqual(f.calls, [true]);
    assert.equal(f.store.writes, 0);
  });
}
test('Auth: token ausente y cabecera mal formada', async () => {
  const f = fixture();
  for (const header of ['', 'Basic secret', 'Bearer one two', 'Bearer one,other', 'Bearer']) {
    await request(f.app).get(f.me).set('Authorization', header).expect(401);
  }
  assert.equal(f.calls.length, 0);
});
test('Auth: proveedor no permitido, correo ausente y fallo de infraestructura', async () => {
  const f = fixture();
  await request(f.app).post(f.me).auth('unsupported', { type: 'bearer' }).send({}).expect(403);
  await request(f.app).post(f.me).auth('noemail', { type: 'bearer' }).send({}).expect(400);
  await request(f.app).get(f.me).auth('outage', { type: 'bearer' }).expect(503);
});
test('CRUD propio: token válido, creación, consulta, actualización y eliminación idempotente', async () => {
  const f = fixture();
  const created = await request(f.app).post(f.me).auth('ana', { type: 'bearer' }).send(complete).expect(201);
  assert.equal(created.body.firstName, 'Ana');
  assert.equal(created.body.email, 'ana@example.com');
  assert.equal(created.body.authProvider, 'google.com');
  assert.equal(created.body.usernameNormalized, 'ana_01');
  assert.equal(created.body.profileCompleted, true);
  assert.ok(!Number.isNaN(Date.parse(created.body.createdAt)));
  assert.deepEqual(f.store.data.get('usernames/ana_01'), { uid: 'ana' });
  await request(f.app).get(f.me).auth('ana', { type: 'bearer' }).expect(200, created.body);
  await request(f.app).post(f.me).auth('ana', { type: 'bearer' }).send(complete).expect(409);
  const updated = await request(f.app).patch(f.me).auth('ana', { type: 'bearer' }).send({ avatarId: 'avatar_lamp' }).expect(200);
  assert.equal(updated.body.createdAt, created.body.createdAt);
  assert.equal(updated.body.avatarId, 'avatar_lamp');
  await request(f.app).get('/private').auth('ana', { type: 'bearer' }).expect(200);
  await request(f.app).delete(f.me).auth('ana', { type: 'bearer' }).expect(204, '');
  assert.equal(f.store.data.size, 0);
  await request(f.app).delete(f.me).auth('ana', { type: 'bearer' }).expect(204);
  await request(f.app).get(f.me).auth('ana', { type: 'bearer' }).expect(404);
});
test('Unicidad: nombre ocupado insensible a mayúsculas', async () => {
  const f = fixture();
  await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send(complete).expect(201);
  await request(f.app).post(f.me).auth('b', { type: 'bearer' }).send({ ...complete, username: 'ANA_01' }).expect(409);
  assert.equal(f.store.data.has('users/b'), false);
});
test('Unicidad: solicitudes concurrentes tienen un solo ganador', async () => {
  const f = fixture();
  const responses = await Promise.all(['a', 'b'].map(uid => request(f.app).post(f.me).auth(uid, { type: 'bearer' }).send(complete)));
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]);
  assert.equal(f.store.data.size, 2);
});
test('Cambio de nombre: reserva y liberación, presentación y conflicto sin cambios parciales', async () => {
  const f = fixture();
  await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send(complete).expect(201);
  await request(f.app).post(f.me).auth('b', { type: 'bearer' }).send({ username: 'ocupado' }).expect(201);
  await request(f.app).patch(f.me).auth('a', { type: 'bearer' }).send({ username: 'ocupado' }).expect(409);
  assert.deepEqual(f.store.data.get('usernames/ana_01'), { uid: 'a' });
  await request(f.app).patch(f.me).auth('a', { type: 'bearer' }).send({ username: 'Nuevo_02' }).expect(200);
  assert.equal(f.store.data.has('usernames/ana_01'), false);
  assert.deepEqual(f.store.data.get('usernames/nuevo_02'), { uid: 'a' });
  await request(f.app).patch(f.me).auth('a', { type: 'bearer' }).send({ username: 'NUEVO_02' }).expect(200);
  assert.equal(f.store.data.get('users/a')?.username, 'NUEVO_02');
  await request(f.app).delete(f.me).auth('a', { type: 'bearer' }).expect(204);
  assert.equal(f.store.data.has('usernames/nuevo_02'), false);
  await request(f.app).post(f.me).auth('c', { type: 'bearer' }).send({ username: 'nuevo_02' }).expect(201);
});
for (const [label, body] of Object.entries({
  array: [], null: null, firstNameType: { firstName: 1 }, emptyName: { lastName: '  ' }, longName: { firstName: 'a'.repeat(101) },
  usernameShort: { username: 'ab' }, usernameLong: { username: 'a'.repeat(21) }, usernameSpaces: { username: ' abc' }, usernameUnicode: { username: 'ábc' },
  usernameHyphen: { username: 'a-b' }, usernameNumber: { username: 12 }, avatarNull: { avatarId: null }, avatarUrl: { avatarId: 'https://example.com/a.png' },
  unknown: { role: 'admin' }, uid: { uid: 'other' }, email: { email: 'other@example.com' }, authProvider: { authProvider: 'password' },
  normalized: { usernameNormalized: 'abc' }, completed: { profileCompleted: true }, createdAt: { createdAt: '2026-01-01' }, updatedAt: { updatedAt: '2026-01-01' },
})) {
  test(`Validación: ${label} se rechaza antes de escribir`, async () => {
    const f = fixture();
    // JSON null pasa por el parser estricto de Express.
    await request(f.app).post(f.me).auth('a', { type: 'bearer' }).set('Content-Type', 'application/json').send(JSON.stringify(body)).expect(400);
    assert.equal(f.store.writes, 0);
  });
}
test('Perfil incompleto de Google, acceso privado bloqueado y completado posterior', async () => {
  const f = fixture();
  await request(f.app).get('/private').auth('a', { type: 'bearer' }).expect(403);
  const r = await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send({}).expect(201);
  assert.equal(r.body.username, null); assert.equal(r.body.firstName, null);
  assert.equal(r.body.avatarId, 'avatar_book'); assert.equal(r.body.profileCompleted, false);
  assert.equal(f.store.data.size, 1);
  await request(f.app).get('/private').auth('a', { type: 'bearer' }).expect(403);
  await request(f.app).patch(f.me).auth('a', { type: 'bearer' }).send(complete).expect(200);
  await request(f.app).get('/private').auth('a', { type: 'bearer' }).expect(200);
  for (const body of [{ username: null }, { firstName: null }, { lastName: null }]) {
    await request(f.app).patch(f.me).auth('a', { type: 'bearer' }).send(body).expect(400);
  }
});
test('UID: no hay lectura ni modificación de perfiles ajenos', async () => {
  const f = fixture();
  await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send(complete).expect(201);
  await request(f.app).get(f.me).auth('b', { type: 'bearer' }).expect(404);
  await request(f.app).patch(f.me).auth('b', { type: 'bearer' }).send({ firstName: 'Otro' }).expect(404);
  await request(f.app).get('/api/v1/users/a').auth('b', { type: 'bearer' }).expect(404);
  await request(f.app).delete(f.me).auth('b', { type: 'bearer' }).expect(204);
  assert.equal(f.store.data.get('users/a')?.firstName, 'Ana');
});
test('Firestore: indisponibilidad y errores internos no filtran secretos', async () => {
  for (const [code, expected] of [[14, 503], [10, 503], [4, 503], [7, 500]] as const) {
    const f = fixture(); f.store.failure = { code, message: 'SECRET' };
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const r = await request(f.app)[method](f.me).auth('a', { type: 'bearer' }).send({}).expect(expected);
      assert.ok(!JSON.stringify(r.body).includes('SECRET'));
    }
    assert.equal(f.store.data.size, 0);
  }
});
test('Inconsistencias: reserva ausente o ajena no se borra ni habilita acceso', async () => {
  for (const owner of [undefined, 'other']) {
    const f = fixture();
    await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send(complete).expect(201);
    if (owner) f.store.data.set('usernames/ana_01', { uid: owner }); else f.store.data.delete('usernames/ana_01');
    await request(f.app).get(f.me).auth('a', { type: 'bearer' }).expect(409);
    await request(f.app).patch(f.me).auth('a', { type: 'bearer' }).send({ username: 'nuevo' }).expect(409);
    await request(f.app).delete(f.me).auth('a', { type: 'bearer' }).expect(409);
    await request(f.app).get('/private').auth('a', { type: 'bearer' }).expect(409);
    assert.ok(f.store.data.has('users/a'));
    if (owner) assert.equal(f.store.data.get('usernames/ana_01')?.uid, owner);
  }
});
test('Reservas huérfanas y adicionales requieren reconciliación', async () => {
  const f = fixture();
  f.store.data.set('usernames/huérfano', { uid: 'a' });
  await request(f.app).delete(f.me).auth('a', { type: 'bearer' }).expect(409);
  await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send({}).expect(409);
  assert.equal(f.store.data.size, 1);
});
test('Nombre de usuario: salto de línea final rechazado; límites válidos aceptados', async () => {
  const f = fixture();
  await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send({ username: 'abc\n' }).expect(400);
  for (const [uid, username] of [['b', 'a_1'], ['c', 'a'.repeat(20)]]) {
    await request(f.app).post(f.me).auth(uid, { type: 'bearer' }).send({ username }).expect(201);
  }
});
test('Password: identidad verificada y sincronización de correo, nunca campos del cliente', async () => {
  const f = fixture();
  const auth = createAuthService(async (_token, revoked) => {
    assert.equal(revoked, true);
    return { uid: 'password-user', email: 'primero@example.com', firebase: { sign_in_provider: 'password' } } as DecodedIdToken;
  });
  const identity = await auth('verified');
  assert.ok(Object.isFrozen(identity));
  assert.deepEqual(Object.keys(identity).sort(), ['email', 'provider', 'uid']);
  const created = await f.service.create(identity, {});
  assert.equal(created.authProvider, 'password');
  const updated = await f.service.update({ ...identity, email: 'nuevo@example.com' }, {});
  assert.equal(updated.email, 'nuevo@example.com');
  assert.equal(updated.createdAt, created.createdAt);
});
test('Inconsistencias: datos corruptos y reservas adicionales no se exponen', async () => {
  for (const corrupt of ['extra', 'missing', 'additional-reservation']) {
    const f = fixture();
    await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send(complete).expect(201);
    const data = f.store.data.get('users/a')!;
    if (corrupt === 'extra') data.password = 'SECRET';
    if (corrupt === 'missing') delete data.avatarId;
    if (corrupt === 'additional-reservation') f.store.data.set('usernames/extra', { uid: 'a' });
    const response = await request(f.app).get(f.me).auth('a', { type: 'bearer' }).expect(409);
    assert.ok(!JSON.stringify(response.body).includes('SECRET'));
    await request(f.app).delete(f.me).auth('a', { type: 'bearer' }).expect(409);
  }
});
test('Transacción abortada no deja reserva o cambio de nombre parcial', async () => {
  const f = fixture();
  f.store.failOnWrite = 2;
  await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send(complete).expect(503);
  assert.equal(f.store.data.size, 0);
  f.store.failOnWrite = undefined;
  await request(f.app).post(f.me).auth('a', { type: 'bearer' }).send(complete).expect(201);
  f.store.failOnWrite = f.store.writes + 3;
  await request(f.app).patch(f.me).auth('a', { type: 'bearer' }).send({ username: 'nuevo' }).expect(503);
  assert.equal(f.store.data.has('usernames/nuevo'), false);
  assert.equal(f.store.data.get('usernames/ana_01')?.uid, 'a');
  assert.equal(f.store.data.get('users/a')?.username, 'Ana_01');
});


test('US-01: registro manual HTTP con identidad password y perfil propio persistido', async () => {
  const f = fixture('password');
  await request(f.app).get(f.me).auth('manual', { type: 'bearer' }).expect(404);
  assert.equal(f.store.data.size, 0);
  const created = await request(f.app).post(f.me).auth('manual', { type: 'bearer' }).send(complete).expect(201);
  assert.equal(created.body.email, 'manual@example.com');
  assert.equal(created.body.authProvider, 'password');
  assert.equal(created.body.profileCompleted, true);
  assert.equal(created.body.usernameNormalized, 'ana_01');
  assert.deepEqual(f.store.data.get('usernames/ana_01'), { uid: 'manual' });
  assert.deepEqual(Object.keys(f.store.data.get('users/manual')!).sort(), Object.keys(created.body).sort());
  await request(f.app).get(f.me).auth('manual', { type: 'bearer' }).expect(200, created.body);
  const writes = f.store.writes;
  await request(f.app).post(f.me).auth('manual', { type: 'bearer' }).send({ ...complete, username: 'Otro_01' }).expect(409);
  assert.equal(f.store.writes, writes);
  await request(f.app).get(f.me).auth('manual', { type: 'bearer' }).expect(200, created.body);
  assert.ok(f.calls.every(revoked => revoked === true));
});

test('US-01: POST manual exige token antes de escribir o validar datos del perfil', async () => {
  const f = fixture('password');
  await request(f.app).post(f.me).send(complete).expect(401);
  for (const token of ['invalid', 'expired', 'revoked', 'disabled', 'deleted']) {
    await request(f.app).post(f.me).auth(token, { type: 'bearer' }).send(complete).expect(401);
  }
  assert.equal(f.store.writes, 0);
  assert.equal(f.store.data.size, 0);
});

test('US-01: correo inválido o ausente de Firebase impide crear el perfil manual', async () => {
  const f = fixture('password');
  for (const token of ['noemail', 'bademail']) {
    const response = await request(f.app).post(f.me).auth(token, { type: 'bearer' }).send(complete).expect(400);
    assert.deepEqual(response.body, { error: 'El token debe contener un correo válido' });
  }
  assert.equal(f.store.writes, 0);
});

test('US-01: contraseña y campos de identidad del cliente se rechazan en POST y PATCH', async () => {
  const f = fixture('password');
  await request(f.app).post(f.me).auth('manual', { type: 'bearer' }).send(complete).expect(201);
  const before = new Map(f.store.data);
  const writes = f.store.writes;
  for (const method of ['post', 'patch'] as const) {
    for (const body of [{ password: 'clave-ficticia' }, { confirmPassword: 'clave-ficticia' }, { email: 'otro@example.com' }, { uid: 'victima' }]) {
      const response = await request(f.app)[method](f.me).auth('manual', { type: 'bearer' }).send(body).expect(400);
      assert.deepEqual(response.body, { error: 'Campo desconocido o administrado por el servidor' });
    }
  }
  assert.equal(f.store.writes, writes);
  assert.deepEqual(f.store.data, before);
});

test('US-01: perfil manual incompleto se completa sin repetir la creación', async () => {
  const f = fixture('password');
  const initial = await request(f.app).post(f.me).auth('manual', { type: 'bearer' }).send({}).expect(201);
  assert.equal(initial.body.authProvider, 'password');
  assert.equal(initial.body.profileCompleted, false);
  assert.equal(initial.body.avatarId, 'avatar_book');
  assert.equal(initial.body.usernameNormalized, null);
  assert.equal(f.store.data.size, 1);
  await request(f.app).get('/private').auth('manual', { type: 'bearer' }).expect(403);
  const completed = await request(f.app).patch(f.me).auth('manual', { type: 'bearer' }).send(complete).expect(200);
  assert.equal(completed.body.profileCompleted, true);
  assert.equal(completed.body.createdAt, initial.body.createdAt);
  await request(f.app).get('/private').auth('manual', { type: 'bearer' }).expect(200);
});

test('US-01: conflicto manual y selección de UID por URL o query no dan acceso ajeno', async () => {
  const f = fixture('password');
  const owner = await request(f.app).post(f.me).auth('owner', { type: 'bearer' }).send(complete).expect(201);
  await request(f.app).post(f.me).auth('other', { type: 'bearer' }).send({ ...complete, username: 'ANA_01' }).expect(409);
  assert.equal(f.store.data.has('users/other'), false);
  for (const method of ['get', 'patch', 'delete'] as const) {
    await request(f.app)[method]('/api/v1/users/owner').auth('other', { type: 'bearer' }).send({ firstName: 'Otro' }).expect(404);
  }
  await request(f.app).get(`${f.me}?uid=owner`).auth('other', { type: 'bearer' }).expect(404);
  await request(f.app).patch(`${f.me}?uid=owner`).auth('other', { type: 'bearer' }).send({ firstName: 'Otro' }).expect(404);
  await request(f.app).delete(`${f.me}?uid=owner`).auth('other', { type: 'bearer' }).expect(204);
  await request(f.app).get(f.me).auth('owner', { type: 'bearer' }).expect(200, owner.body);
  assert.deepEqual(f.store.data.get('usernames/ana_01'), { uid: 'owner' });
});

test('US-01: fallo de lectura posterior al commit permite recuperar el perfil con GET', async () => {
  const f = fixture('password');
  const transaction = f.store.transaction.bind(f.store);
  let transactions = 0;
  f.store.transaction = async fn => {
    if (++transactions === 2) throw { code: 14, message: 'SECRET' };
    return transaction(fn);
  };
  const response = await request(f.app).post(f.me).auth('manual', { type: 'bearer' }).send(complete).expect(503);
  assert.deepEqual(response.body, { error: 'Servicio temporalmente no disponible' });
  assert.ok(f.store.data.has('users/manual'));
  const recovered = await request(f.app).get(f.me).auth('manual', { type: 'bearer' }).expect(200);
  assert.equal(recovered.body.profileCompleted, true);
  await request(f.app).post(f.me).auth('manual', { type: 'bearer' }).send(complete).expect(409);
  assert.equal(f.store.data.size, 2);
});

test('US-02: nombres de Google sin username nunca completan el perfil', async () => {
  for (const username of [undefined, null]) {
    const f = fixture('google.com');
    const body = { firstName: 'Ana', lastName: 'Perez', ...(username === null ? { username } : {}) };
    const created = await request(f.app).post(f.me).auth('google-user', { type: 'bearer' }).send(body).expect(201);
    assert.equal(created.body.authProvider, 'google.com');
    assert.equal(created.body.email, 'google-user@example.com');
    assert.equal(created.body.profileCompleted, false);
    assert.equal(created.body.username, null);
    assert.equal(created.body.usernameNormalized, null);
    assert.equal(f.store.data.size, 1);
    await request(f.app).get('/private').auth('google-user', { type: 'bearer' }).expect(403);
    const completed = await request(f.app).patch(f.me).auth('google-user', { type: 'bearer' }).send({ username: 'Google_01' }).expect(200);
    assert.equal(completed.body.profileCompleted, true);
    assert.equal(completed.body.createdAt, created.body.createdAt);
    assert.deepEqual(f.store.data.get('usernames/google_01'), { uid: 'google-user' });
    await request(f.app).get('/private').auth('google-user', { type: 'bearer' }).expect(200);
  }
});

test('US-02: la reserva de username es global entre password y Google', async () => {
  const f = fixture('google.com');
  await f.service.create({ uid: 'password-owner', email: 'owner@example.com', provider: 'password' }, complete);
  const writes = f.store.writes;
  const response = await request(f.app).post(f.me).auth('google-user', { type: 'bearer' }).send({ ...complete, username: 'ANA_01' }).expect(409);
  assert.deepEqual(response.body, { error: 'Nombre de usuario ocupado' });
  assert.equal(f.store.writes, writes);
  assert.equal(f.store.data.has('users/google-user'), false);
  assert.deepEqual(f.store.data.get('usernames/ana_01'), { uid: 'password-owner' });
});

test('US-02: identidades vinculadas conservan UID; el mismo correo no fusiona perfiles', async () => {
  const f = fixture('google.com');
  const original = { uid: 'linked-user', email: 'ficticio@example.com', provider: 'password' };
  const created = await f.service.create(original, complete);
  const google = { ...original, provider: 'google.com' };
  const updated = await f.service.update(google, {});
  assert.equal(updated.authProvider, 'google.com');
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.username, created.username);
  assert.deepEqual(f.store.data.get('usernames/ana_01'), { uid: original.uid });
  const other = { ...google, uid: 'different-google-user' };
  await assert.rejects(f.service.read(other), { status: 404 });
  await assert.rejects(f.service.create(other, complete), { status: 409 });
  assert.equal(f.store.data.has('users/different-google-user'), false);
  assert.equal(f.store.data.size, 2);
});

test('US-02: identidad Google mínima y UID inválido rechazado tras verificar token', async () => {
  for (const uid of ['', 'users/other']) {
    const verify = createAuthService(async (_token, revoked) => {
      assert.equal(revoked, true);
      return { uid, email: 'ficticio@example.com', firebase: { sign_in_provider: 'google.com' } } as DecodedIdToken;
    });
    await assert.rejects(verify('simulated'), { status: 401, message: 'Identidad inválida' });
  }
  const verify = createAuthService(async () => ({
    uid: 'google-user', sub: 'google-user', email: 'ficticio@example.com', name: 'Nombre sugerido',
    aud: 'demo-us02', iss: 'https://securetoken.google.com/demo-us02', auth_time: 0, iat: 0, exp: 1,
    firebase: { sign_in_provider: 'google.com', identities: {} },
  }) as DecodedIdToken);
  const identity = await verify('simulated');
  assert.deepEqual(identity, { uid: 'google-user', email: 'ficticio@example.com', provider: 'google.com' });
  assert.ok(Object.isFrozen(identity));
});

test('US-02: username vacío, solo espacios o con punto no crea ni completa perfil Google', async () => {
  const f = fixture('google.com');
  for (const username of ['', '   ', 'ana.p']) {
    await request(f.app).post(f.me).auth('google-user', { type: 'bearer' }).send({ username }).expect(400);
  }
  assert.equal(f.store.writes, 0);
  await request(f.app).post(f.me).auth('google-user', { type: 'bearer' }).send({ firstName: 'Ana', lastName: 'Perez' }).expect(201);
  const writes = f.store.writes;
  for (const username of ['', '   ', 'ana.p']) {
    await request(f.app).patch(f.me).auth('google-user', { type: 'bearer' }).send({ username }).expect(400);
  }
  assert.equal(f.store.writes, writes);
  assert.equal(f.store.data.get('users/google-user')?.profileCompleted, false);
  await request(f.app).get('/private').auth('google-user', { type: 'bearer' }).expect(403);
});
