import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { env } from './env';

const admin = { applicationDefault, getApps, initializeApp };

// La inicialización es diferida: importar este módulo no requiere ADC.
export function getFirebaseApp(sdk: typeof admin = admin) {
  const existing = sdk.getApps().find((app) => app.name === '[DEFAULT]');
  if (existing) return existing;
  const projectId = env.firebaseProjectId;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID es obligatorio para usar Firestore');
  return sdk.initializeApp({ projectId, credential: sdk.applicationDefault() });
}
