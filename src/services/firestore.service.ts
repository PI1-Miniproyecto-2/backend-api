import { getFirestore } from 'firebase-admin/firestore';
import { getFirebaseApp } from '../config/firebase';

export function getFirestoreClient() {
  // Sin databaseId explícito, Firebase utiliza la base (default).
  return getFirestore(getFirebaseApp());
}

export interface DocumentReader {
  doc(path: string): {
    get(): Promise<{ exists: boolean; get(field: string): unknown }>;
  };
}

export async function checkFirestoreConnection(db: DocumentReader = getFirestoreClient()): Promise<void> {
  const snapshot = await db.doc('system_checks/connection-test').get();
  if (!snapshot.exists) throw new Error('No existe system_checks/connection-test');
  if (snapshot.get('status') !== 'ok') {
    throw new Error('system_checks/connection-test debe tener status "ok"');
  }
}
