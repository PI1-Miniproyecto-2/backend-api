import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Firestore } from 'firebase-admin/firestore';
import { createRoomMembersService } from '../src/services/room-members.service';
import { DEFAULT_AVATAR } from '../src/config/avatars';

const roomId = 'A1234567890123456789';

function fixture() {
  let room: Record<string, unknown> | undefined = {
    ownerUid: 'ana',
    participantUids: ['ana', 'bea'],
    status: 'active',
  };

  let historyReads = 0;
  let profileReads = 0;

  const profiles: Record<string, Record<string, unknown>> = {
    ana: {
      firstName: 'Ana',
      lastName: 'García',
      username: 'ana',
      avatarId: DEFAULT_AVATAR,
      email: 'ana@example.com',
    },
    bea: {
      firstName: 'Beatriz',
      lastName: 'López',
      username: 'bea',
      avatarId: DEFAULT_AVATAR,
    },
    carlos: {
      firstName: 'Carlos',
      username: 'carlos',
      avatarId: DEFAULT_AVATAR,
    },
  };

  const messages = [
    { roomId, authorUid: 'ana' },
    { roomId, authorUid: 'carlos' },
    { roomId, authorUid: 'carlos' },
    { roomId, authorUid: 'eliminado' },
    { roomId: 'otra-sala', authorUid: 'externo' },
  ];

  const db = {
    collection(name: string) {
      return {
        doc(id: string) {
          return { name, id };
        },

        where(field: string, operator: string, value: string) {
          assert.equal(name, 'realtime_messages');
          assert.equal(field, 'roomId');
          assert.equal(operator, '==');

          return {
            select(selected: string) {
              assert.equal(selected, 'authorUid');
              return { name, value };
            },
          };
        },
      };
    },

    async runTransaction<T>(
      operation: (tx: unknown) => Promise<T>
    ): Promise<T> {
      return operation({
        async get(target: {
          name: string;
          id?: string;
          value?: string;
        }) {
          if (target.name === 'rooms') {
            return {
              data: () =>
                target.id === roomId ? room : undefined,
            };
          }

          historyReads++;

          return {
            docs: messages
              .filter(message =>
                message.roomId === target.value
              )
              .map(message => ({
                data: () => ({
                  authorUid: message.authorUid,
                }),
              })),
          };
        },

        async getAll(
          ...refs: { name: string; id: string }[]
        ) {
          profileReads++;

          return refs.map(ref => {
            assert.equal(ref.name, 'users');

            return {
              id: ref.id,
              data: () => profiles[ref.id],
            };
          });
        },
      });
    },
  } as unknown as Firestore;

  return {
    service: createRoomMembersService(() => db),

    setRoom(value: Record<string, unknown> | undefined) {
      room = value;
    },

    reads() {
      return { historyReads, profileReads };
    },
  };
}

test('US-08: devuelve participantes y autores históricos sin duplicados', async () => {
  const { service } = fixture();

  const result = await service.list('ana', roomId);

  assert.deepEqual(
    result.members.map(member => member.uid).sort(),
    ['ana', 'bea', 'carlos', 'eliminado']
  );
});

test('US-08: permite consultar a un participante autorizado', async () => {
  const { service } = fixture();

  const result = await service.list('bea', roomId);

  assert.equal(result.members.length, 4);
});

test('US-08: no devuelve correos ni campos privados', async () => {
  const { service } = fixture();

  const result = await service.list('ana', roomId);

  for (const member of result.members) {
    assert.deepEqual(
      Object.keys(member).sort(),
      ['avatarId', 'displayName', 'uid', 'username']
    );
  }

  const ana = result.members.find(
    member => member.uid === 'ana'
  );

  assert.equal(ana?.displayName, 'Ana García');
});

test('US-08: conserva la referencia de autores eliminados', async () => {
  const { service } = fixture();

  const result = await service.list('ana', roomId);

  const deleted = result.members.find(
    member => member.uid === 'eliminado'
  );

  assert.deepEqual(deleted, {
    uid: 'eliminado',
    displayName: 'Usuario no disponible',
    username: null,
    avatarId: DEFAULT_AVATAR,
  });
});

test('US-08: rechaza usuarios ajenos antes de consultar perfiles', async () => {
  const { service, reads } = fixture();

  for (const uid of ['externo', 'carlos']) {
    await assert.rejects(
      service.list(uid, roomId),
      { message: 'Sala no encontrada' }
    );
  }

  assert.deepEqual(reads(), {
    historyReads: 0,
    profileReads: 0,
  });
});

test('US-08: rechaza salas inexistentes o inactivas', async () => {
  const { service, setRoom, reads } = fixture();

  setRoom(undefined);

  await assert.rejects(
    service.list('ana', roomId),
    { message: 'Sala no encontrada' }
  );

  setRoom({
    ownerUid: 'ana',
    participantUids: ['ana'],
    status: 'inactive',
  });

  await assert.rejects(
    service.list('ana', roomId),
    { message: 'Sala no encontrada' }
  );

  assert.deepEqual(reads(), {
    historyReads: 0,
    profileReads: 0,
  });
});

test('US-08: rechaza identificadores inválidos', async () => {
  const { service } = fixture();

  await assert.rejects(
    service.list('ana', 'invalido')
  );
});