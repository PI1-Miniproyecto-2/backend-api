import { ApiError } from './api-error';

const MAX_ROOM_NAME_LENGTH = 100;

export function validateRoomName(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body) ||
      !Object.hasOwn(body, 'name') || Object.keys(body).length !== 1 ||
      !('name' in body) || typeof body.name !== 'string') {
    throw new ApiError(400, 'El cuerpo debe contener únicamente el campo name como texto');
  }
  const name = body.name.trim();
  if (!name || name.length > MAX_ROOM_NAME_LENGTH) {
    throw new ApiError(400, 'El nombre debe tener entre 1 y 100 caracteres');
  }
  return name;
}

export function validateRoomId(roomId: string): void {
  if (!/^[A-Za-z0-9]{20}$/.test(roomId)) {
    throw new ApiError(400, 'Identificador de sala inválido');
  }
}
