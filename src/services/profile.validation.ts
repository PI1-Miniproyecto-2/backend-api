import { AVATAR_IDS } from '../config/avatars';
import { ApiError } from './api-error';

export interface EditableProfile {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  avatarId?: string;
}
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
export function validateProfileInput(body: unknown): EditableProfile {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Se requiere un objeto JSON');
  const result: EditableProfile = {};
  for (const [key, value] of Object.entries(body)) {
    if (!['firstName', 'lastName', 'username', 'avatarId'].includes(key)) throw new ApiError(400, 'Campo desconocido o administrado por el servidor');
    if (key === 'avatarId') {
      if (typeof value !== 'string' || !AVATAR_IDS.some(id => id === value)) throw new ApiError(400, 'Avatar no permitido');
      result.avatarId = value;
    } else if (key === 'username') {
      if (value !== null && (typeof value !== 'string' || value.match(USERNAME_PATTERN)?.[0] !== value)) throw new ApiError(400, 'Nombre de usuario inválido: use 3 a 20 letras ASCII, números o guion bajo');
      result.username = value as string | null;
    } else {
      if (value !== null && (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > 100)) throw new ApiError(400, 'Nombre o apellido inválido');
      result[key as 'firstName' | 'lastName'] = value === null ? null : (value as string).trim();
    }
  }
  return result;
}
