import { checkFirestoreConnection, getFirestoreClient } from '../services/firestore.service';

async function main(): Promise<void> {
  // Evita informar éxito contra un emulador al comprobar la conexión real.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Desactiva FIRESTORE_EMULATOR_HOST para comprobar Firestore real');
  }
  const db = getFirestoreClient();
  try {
    await checkFirestoreConnection(db);
    console.log('Firestore: lectura correcta de system_checks/connection-test; status="ok".');
  } finally {
    await db.terminate();
  }
}

void main().catch(() => {
  // No imprimir objetos del SDK: podrían incluir información sensible.
  console.error('Comprobación fallida. Revisa FIREBASE_PROJECT_ID, ADC, permisos de lectura y el documento con status="ok".');
  process.exitCode = 1;
});
