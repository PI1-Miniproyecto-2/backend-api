import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { App, Credential } from 'firebase-admin/app';
import { env } from '../src/config/env';
import { getFirebaseApp } from '../src/config/firebase';

test('Firebase usa ADC y reutiliza la aplicación predeterminada', () => {
  const previous = env.firebaseProjectId;
  env.firebaseProjectId = 'proyecto-test';
  const apps: App[] = [];
  const credential = {} as Credential;
  let initializations = 0;
  const sdk: Parameters<typeof getFirebaseApp>[0] = {
    getApps: () => apps,
    applicationDefault: () => credential,
    initializeApp: (options) => {
      initializations++;
      assert.equal(options?.projectId, 'proyecto-test');
      assert.equal(options?.credential, credential);
      const app = { name: '[DEFAULT]' } as App;
      apps.push(app);
      return app;
    },
  };
  try {
    assert.equal(getFirebaseApp(sdk), getFirebaseApp(sdk));
    assert.equal(initializations, 1);
    env.firebaseProjectId = undefined;
    assert.throws(() => getFirebaseApp({ ...sdk, getApps: () => [] }), /FIREBASE_PROJECT_ID/);
  } finally {
    env.firebaseProjectId = previous;
  }
});
