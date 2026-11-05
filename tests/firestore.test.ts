import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFirestoreConnection, type DocumentReader } from '../src/services/firestore.service';

function reader(exists: boolean, status: unknown): DocumentReader {
  return {
    doc(path) {
      assert.equal(path, 'system_checks/connection-test');
      return { async get() {
        return { exists, get(field) { assert.equal(field, 'status'); return status; } };
      } };
    },
  };
}

test('Firestore: acepta el documento existente con status ok', async () => {
  await checkFirestoreConnection(reader(true, 'ok'));
});

test('Firestore: rechaza un documento inexistente', async () => {
  await assert.rejects(checkFirestoreConnection(reader(false, undefined)), /No existe/);
});

test('Firestore: rechaza status incorrecto o ausente', async () => {
  for (const status of [undefined, 'error', true]) {
    await assert.rejects(checkFirestoreConnection(reader(true, status)), /status/);
  }
});

test('Firestore: propaga fallos de lectura', async () => {
  const failure = new Error('lectura rechazada');
  const db: DocumentReader = { doc: () => ({ get: async () => { throw failure; } }) };
  await assert.rejects(checkFirestoreConnection(db), (error) => error === failure);
});
