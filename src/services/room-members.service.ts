import type { Firestore } from 'firebase-admin/firestore';
import type { RoomMembersResponse } from '../models/room-member';
import { DEFAULT_AVATAR } from '../config/avatars';
import { getFirestoreClient } from './firestore.service';
import { ApiError, infrastructureError } from './api-error';
import { validateRoomId } from './room.validation';

function validUid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    !value.includes('/') &&
    value !== '.' &&
    value !== '..'
  );
}

export function createRoomMembersService(
  client: () => Firestore = getFirestoreClient
) {
  return {
    async list(
      uid: string,
      roomId: string
    ): Promise<RoomMembersResponse> {
      validateRoomId(roomId);

      try {
        const db = client();

        return await db.runTransaction(async tx => {
          const roomRef = db.collection('rooms').doc(roomId);
          const roomSnapshot = await tx.get(roomRef);
          const room = roomSnapshot.data();

          if (!room || room.status !== 'active') {
            throw new ApiError(404, 'Sala no encontrada');
          }

          const participants: string[] =
            Array.isArray(room.participantUids)
              ? room.participantUids.filter(validUid)
              : [];

          if (
            room.ownerUid !== uid &&
            !participants.includes(uid)
          ) {
            throw new ApiError(404, 'Sala no encontrada');
          }

          const memberUids = new Set<string>(participants);

          if (validUid(room.ownerUid)) {
            memberUids.add(room.ownerUid);
          }

          // Recuperar también los autores del historial.
          const messagesQuery = db
            .collection('realtime_messages')
            .where('roomId', '==', roomId)
            .select('authorUid');

          const messages = await tx.get(messagesQuery);

          for (const message of messages.docs) {
            const authorUid = message.data().authorUid;

            if (validUid(authorUid)) {
              memberUids.add(authorUid);
            }
          }

          const uids = [...memberUids];

          const members: RoomMembersResponse['members'] = [];

          // Consultar los perfiles en grupos.
          for (let i = 0; i < uids.length; i += 100) {
            const batch = uids.slice(i, i + 100);

            const refs = batch.map(memberUid =>
              db.collection('users').doc(memberUid)
            );

            const profiles = await tx.getAll(...refs);

            for (const profile of profiles) {
              const data = profile.data();

              const username =
                typeof data?.username === 'string'
                  ? data.username
                  : null;

              const fullName = [
                data?.firstName,
                data?.lastName,
              ]
                .filter(
                  (value): value is string =>
                    typeof value === 'string' &&
                    value.trim().length > 0
                )
                .map(value => value.trim())
                .join(' ');

              members.push({
                uid: profile.id,
                displayName:
                  fullName ||
                  username ||
                  'Usuario no disponible',
                username,
                avatarId:
                  typeof data?.avatarId === 'string'
                    ? data.avatarId
                    : DEFAULT_AVATAR,
              });
            }
          }

          return { members };
        });
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        return infrastructureError(error);
      }
    },
  };
}

export type RoomMembersService =
  ReturnType<typeof createRoomMembersService>;