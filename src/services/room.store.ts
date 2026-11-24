
import type { Firestore } from 'firebase-admin/firestore';
import type { Room, RoomDocument } from '../models/room';
import { getFirestoreClient } from './firestore.service';

export const ROOM_LIST_LIMIT = 50;

export interface RoomStore {
  create(data: RoomDocument): Promise<string>;
  listOwned(uid: string): Promise<Room[]>;
  read(roomId: string): Promise<Room | undefined>;
  join(roomId: string, uid: string): Promise<Room | undefined>;
}

export function createRoomStore(client: () => Firestore = getFirestoreClient): RoomStore {
  const rooms = () => client().collection('rooms');

  return {
    async create(data) {
      const ref = rooms().doc();
      await ref.create(data);
      return ref.id;
    },

    async listOwned(uid) {
      // El índice de ownerUid ya ordena por ID de documento como desempate.
      const result = await rooms().where('ownerUid', '==', uid).limit(ROOM_LIST_LIMIT).get();
      return result.docs.map(doc => ({ ...doc.data() as RoomDocument, roomId: doc.id }));
    },

    async read(roomId) {
      const doc = await rooms().doc(roomId).get();
      const data = doc.data();
      return data && { ...data as RoomDocument, roomId: doc.id };
    },

    // US-07: Registrar un participante en una sala existente.
    async join(roomId, uid) {
      const db = client();
      const ref = db.collection('rooms').doc(roomId);

      return db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const data = snapshot.data() as RoomDocument | undefined;

        if (!data || data.status !== 'active') {
          return undefined;
        }

        const participantUids = [
          ...new Set([...data.participantUids, uid]),
        ];

        transaction.update(ref, {
          participantUids,
        });

        return {
          ...data,
          participantUids,
          roomId: snapshot.id,
        };
      });
    },
  };
}
