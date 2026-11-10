import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createProfileStore } from '../src/services/profile.store';

test('Adaptador Firestore: cliente diferido, transacción, consulta por UID y Timestamp de servidor', async () => {
  let clients = 0;
  const operations: unknown[] = [];
  const db = {
    doc: (path: string) => ({ path }),
    collection: (name: string) => ({ where: (...args: unknown[]) => { operations.push([name, ...args]); return { query: true }; } }),
    async runTransaction(fn: (tx: unknown) => Promise<unknown>) {
      operations.push('transaction');
      return fn({
        async get(ref: { path?: string }) {
          operations.push(['get', ref]);
          return ref.path ? { data: () => ({ uid: 'a' }) } : { docs: [{ ref: { path: 'usernames/ana' } }] };
        },
        set: (...args: unknown[]) => operations.push(['set', ...args]),
        delete: (...args: unknown[]) => operations.push(['delete', ...args]),
      });
    },
  } as unknown as Firestore;
  const store = createProfileStore(() => { clients++; return db; });
  assert.equal(clients, 0);
  assert.ok((store.timestamp() as FieldValue).isEqual(FieldValue.serverTimestamp()));
  const result = await store.transaction(async tx => {
    assert.deepEqual(await tx.read('users/a'), { uid: 'a' });
    assert.deepEqual(await tx.reservations('a'), ['usernames/ana']);
    tx.set('usernames/nuevo', { uid: 'a' });
    tx.delete('usernames/ana');
    return 123;
  });
  assert.equal(result, 123);
  assert.equal(clients, 1);
  assert.ok(operations.some(op => JSON.stringify(op) === JSON.stringify(['usernames', 'uid', '==', 'a'])));
  assert.ok(operations.some(op => Array.isArray(op) && op[0] === 'set'));
  assert.ok(operations.some(op => Array.isArray(op) && op[0] === 'delete'));
});
