import { Timestamp } from 'firebase-admin/firestore';
import type { Room, RoomDocument, RoomResponse } from '../models/room';
import { ApiError, infrastructureError } from './api-error';
import { createRoomStore, type RoomStore } from './room.store';
import { validateRoomId, validateRoomName } from './room.validation';

function serialize({ roomId, name, ownerUid, participantUids, createdAt, status }: Room): RoomResponse {
  return { roomId, name, ownerUid, participantUids, createdAt: createdAt.toDate().toISOString(), status };
}

export function createRoomService(store: RoomStore = createRoomStore()) {
  return {
    async create(uid: string, body: unknown): Promise<RoomResponse> {
      const name = validateRoomName(body);
      const data: RoomDocument = {
        name,
        ownerUid: uid,
        participantUids: [uid],
        createdAt: Timestamp.now(),
        status: 'active',
      };
      const roomId = await store.create(data).catch(infrastructureError);
      return serialize({ ...data, roomId });
    },
    async list(uid: string): Promise<{ rooms: RoomResponse[] }> {
      const rooms = await store.listOwned(uid).catch(infrastructureError);
      return { rooms: rooms.map(serialize) };
    },
    async read(uid: string, roomId: string): Promise<RoomResponse> {
      validateRoomId(roomId);
      const room = await store.read(roomId).catch(infrastructureError);
      if (!room || room.status !== 'active' ||
          (room.ownerUid !== uid && !(Array.isArray(room.participantUids) && room.participantUids.includes(uid)))) {
        throw new ApiError(404, 'Sala no encontrada');
      }
      return serialize(room);
    },
  };
}

export type RoomService = ReturnType<typeof createRoomService>;
