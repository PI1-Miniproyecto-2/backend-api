import { Timestamp } from 'firebase-admin/firestore';
import type { ProfileStore } from '../../src/services/profile.store';

// Simula commits atómicos con exclusión mutua. No prueba el motor de Firestore.
export class MemoryStore implements ProfileStore {
  data = new Map<string, Record<string, unknown>>();
  failure: unknown;
  writes = 0;
  failOnWrite?: number;
  private tail: Promise<void> = Promise.resolve();
  timestamp() { return Timestamp.now(); }
  async transaction<T>(fn: Parameters<ProfileStore['transaction']>[0]): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      if (this.failure) throw this.failure;
      const draft = new Map(this.data);
      let writing = false;
      const result = await fn({
        read: async path => { if (writing) throw new Error('Lectura después de escritura'); return draft.get(path); },
        reservations: async uid => {
          if (writing) throw new Error('Consulta después de escritura');
          return [...draft].filter(([p, d]) => p.startsWith('usernames/') && d.uid === uid).map(([p]) => p);
        },
        set: (path, data) => {
          writing = true; this.writes++;
          if (this.writes === this.failOnWrite) throw { code: 14 };
          draft.set(path, data);
        },
        delete: path => { writing = true; this.writes++; draft.delete(path); },
      });
      this.data = draft;
      return result as T;
    } finally { release(); }
  }
}
