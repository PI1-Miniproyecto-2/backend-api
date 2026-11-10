import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getFirestoreClient } from './firestore.service';

export interface ProfileTransaction {
  read(path: string): Promise<Record<string, unknown> | undefined>;
  reservations(uid: string): Promise<string[]>;
  set(path: string, data: Record<string, unknown>): void;
  delete(path: string): void;
}
export interface ProfileStore {
  transaction<T>(fn: (tx: ProfileTransaction) => Promise<T>): Promise<T>;
  timestamp(): unknown;
}
// El cliente se obtiene al operar, no al importar ni al consultar /health.
export function createProfileStore(client: () => Firestore = getFirestoreClient): ProfileStore {
  return {
    timestamp: () => FieldValue.serverTimestamp(),
    transaction: fn => {
      const db = client();
      return db.runTransaction(tx => fn({
        async read(path) { return (await tx.get(db.doc(path))).data(); },
        async reservations(uid) {
          const result = await tx.get(db.collection('usernames').where('uid', '==', uid));
          return result.docs.map(doc => doc.ref.path);
        },
        set(path, data) { tx.set(db.doc(path), data); },
        delete(path) { tx.delete(db.doc(path)); },
      }));
    },
  };
}
