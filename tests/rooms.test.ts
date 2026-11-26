import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import request from 'supertest';
import { app, parseJson } from '../src/app';
import { errorHandler, notFound } from '../src/middlewares/error.middleware';
import type { Room, RoomDocument } from '../src/models/room';
import { createRoomsRoutes } from '../src/routes/rooms.routes';
import { createAuthService } from '../src/services/auth.service';
import { createProfileService } from '../src/services/profile.service';
import { createRoomService } from '../src/services/room.service';
import { createRoomStore, ROOM_LIST_LIMIT, type RoomStore } from '../src/services/room.store';
import { MemoryStore } from './helpers/memory-store';

const path = '/api/v1/rooms';
const roomId = 'A1234567890123456789';
const otherRoomId = 'B1234567890123456789';

async function fixture() {
  const data = new Map<string, Room>();
  const profiles = createProfileService(new MemoryStore());
  const auth = createAuthService(async (token, checkRevoked) => {
    assert.equal(checkRevoked, true);
    const codes = new Map([
      ['invalid', 'auth/invalid-id-token'],
      ['expired', 'auth/id-token-expired'],
      ['revoked', 'auth/id-token-revoked'],
      ['deleted', 'auth/user-not-found'],
    ]);
    const code = codes.get(token);
    if (code) throw { code, message: 'DETALLE_INTERNO_SIMULADO' };
    // El UID coincide con el de un perfil completo del proyecto.
    const firebase = token === 'tenant' ? { tenant: 'otro-tenant' } : {};
    return {
      uid: token === 'tenant' ? 'ana' : token,
      firebase: { sign_in_provider: 'password', ...firebase },
    } as DecodedIdToken;
  });
  for (const uid of ['ana', 'bea', 'carlos']) {
    await profiles.create({ uid, email: `${uid}@example.com`, provider: 'password' }, {
      firstName: uid, lastName: 'Pérez', username: `${uid}_01`,
    });
  }
  await profiles.create({ uid: 'incompleto', email: 'incompleto@example.com', provider: 'password' }, {});

 
  const store: RoomStore = {
    async create(doc) {
      data.set(roomId, { ...doc, roomId });
      return roomId;
    },

    async listOwned(uid) {
      return [...data.keys()]
        .sort()
        .map(id => data.get(id)!)
        .filter(room => room.ownerUid === uid)
        .slice(0, ROOM_LIST_LIMIT);
    },

    async read(id) {
      return data.get(id);
    },

    // US-07: Ingreso a salas.
    async join(id, uid) {
      const room = data.get(id);

      if (!room || room.status !== 'active') {
        return undefined;
      }

      const updated = {
        ...room,
        participantUids: [
          ...new Set([...room.participantUids, uid]),
        ],
      };

      data.set(id, updated);

      return updated;
    },

    // US-10: Simulación de edición de salas.
    async update(id, uid, name) {
      const room = data.get(id);

      if (!room || room.status !== 'active') {
        return { status: 'not_found' };
      }

      if (room.ownerUid !== uid) {
        return { status: 'forbidden' };
      }

      const updated = {
        ...room,
        name,
      };

      data.set(id, updated);

      return {
        status: 'updated',
        room: updated,
      };
    },
  };

  const app = express();
  app.use(parseJson);
  app.use(path, createRoomsRoutes(createRoomService(store), auth, profiles));
  app.use(notFound);
  app.use(errorHandler);
  return { client: request(app), data, store };
}

function sample(ownerUid = 'ana', participantUids = [ownerUid]): RoomDocument {
  return { name: 'Matemáticas', ownerUid, participantUids, status: 'active', createdAt: Timestamp.now() };
}

test('POST crea la sala con los campos del servidor y devuelve la fecha ISO', async () => {
  const { client, data } = await fixture();
  const response = await client.post(path).auth('ana', { type: 'bearer' })
    .send({ name: '  Matemáticas  ' }).expect(201);
  const stored = data.get(roomId)!;
  assert.ok(stored.createdAt instanceof Timestamp);
  assert.deepEqual(response.body, {
    roomId, name: 'Matemáticas', ownerUid: 'ana', participantUids: ['ana'],
    createdAt: stored.createdAt.toDate().toISOString(), status: 'active',
  });
});

test('POST requiere autenticación y perfil completo', async () => {
  const { client, data } = await fixture();
  await client.post(path).send({ name: 'Matemáticas' }).expect(401);
  await client.post(path).auth('sinperfil', { type: 'bearer' }).send({ name: 'Matemáticas' }).expect(403);
  assert.equal(data.size, 0);
});

test('Las rutas de salas están montadas en la aplicación principal', async () => {
  const client = request(app);
  await client.post(path).send({ name: 'Matemáticas' }).expect(401);
  await client.get(path).expect(401);
  await client.get(`${path}/${roomId}`).expect(401);
});

test('POST rechaza nombres inválidos y JSON malformado', async () => {
  const { client, data } = await fixture();
  for (const body of [{}, [], { name: 42 }, { name: '  ' }, { name: 'a'.repeat(101) }]) {
    await client.post(path).auth('ana', { type: 'bearer' }).send(body).expect(400);
  }
  await client.post(path).auth('ana', { type: 'bearer' })
    .send({ name: '📚'.repeat(51) }).expect(400);
  await client.post(path).auth('ana', { type: 'bearer' }).type('json')
    .send('{"name":').expect(400, { error: 'JSON inválido' });
  assert.equal(data.size, 0);
});

test('POST rechaza propiedades adicionales y la suplantación del propietario', async () => {
  const { client, data } = await fixture();
  for (const extra of [{ extra: true }, { ownerUid: 'bea' }, { participantUids: ['bea'] },
    { status: 'active' }, { createdAt: '2000-01-01' }]) {
    await client.post(path).auth('ana', { type: 'bearer' })
      .send({ name: 'Matemáticas', ...extra }).expect(400);
  }
  assert.equal(data.size, 0);
});

test('GET lista únicamente salas propias y devuelve arreglo vacío si no hay ninguna', async () => {
  const { client, data } = await fixture();
  data.set(otherRoomId, { ...sample('bea', ['bea', 'ana']), roomId: otherRoomId });
  const own = { ...sample(), roomId };
  data.set(roomId, own);
  await client.get(path).auth('ana', { type: 'bearer' }).expect(200, {
    rooms: [{ ...own, createdAt: own.createdAt.toDate().toISOString() }],
  });
  await client.get(path).auth('carlos', { type: 'bearer' }).expect(200, { rooms: [] });
});

test('GET por ID permite al propietario y al participante autorizado', async () => {
  const { client, data } = await fixture();
  const room = { ...sample('ana', ['ana', 'bea']), roomId };
  data.set(roomId, room);
  for (const uid of ['ana', 'bea']) {
    await client.get(`${path}/${roomId}`).auth(uid, { type: 'bearer' })
      .expect(200, { ...room, createdAt: room.createdAt.toDate().toISOString() });
  }
});

test('GET por ID responde igual si la sala es ajena o inexistente', async () => {
  const { client, data } = await fixture();
  data.set(roomId, { ...sample(), roomId });
  for (const id of [roomId, otherRoomId]) {
    await client.get(`${path}/${id}`).auth('bea', { type: 'bearer' })
      .expect(404, { error: 'Sala no encontrada' });
  }
  await client.get(`${path}/${roomId}`).expect(401);
  await client.get(`${path}/inválido`).auth('ana', { type: 'bearer' }).expect(400);
  await client.get(`${path}/%FF`).auth('ana', { type: 'bearer' }).expect(400);
});

test('GET devuelve un error genérico cuando falla Firestore', async () => {
  const { client, store } = await fixture();
  store.read = async () => { throw { code: 14, message: 'DETALLE_INTERNO_SIMULADO' }; };
  await client.get(`${path}/${roomId}`).auth('ana', { type: 'bearer' })
    .expect(503, { error: 'Servicio temporalmente no disponible' });
});

test('US-06: las tres operaciones rechazan tokens inválidos, expirados, revocados o de cuentas eliminadas', async () => {
  const { client, data } = await fixture();
  const expected = { error: 'Token inválido, expirado o revocado' };
  for (const token of ['invalid', 'expired', 'revoked', 'deleted']) {
    await client.post(path).auth(token, { type: 'bearer' }).send({ name: 'Matemáticas' }).expect(401, expected);
    await client.get(path).auth(token, { type: 'bearer' }).expect(401, expected);
    await client.get(`${path}/${roomId}`).auth(token, { type: 'bearer' }).expect(401, expected);
  }
  assert.equal(data.size, 0);
});

test('US-06: las tres operaciones rechazan otro tenant y un perfil persistido incompleto', async () => {
  const { client, data } = await fixture();
  data.set(roomId, { ...sample(), roomId });
  for (const [token, error] of [
    ['tenant', 'No se admite el acceso a salas desde otro tenant'],
    ['incompleto', 'Debe completar su perfil'],
  ]) {
    await client.post(path).auth(token, { type: 'bearer' }).send({ name: 'Otra sala' }).expect(403, { error });
    await client.get(path).auth(token, { type: 'bearer' }).expect(403, { error });
    await client.get(`${path}/${roomId}`).auth(token, { type: 'bearer' }).expect(403, { error });
  }
  assert.equal(data.get(roomId)?.name, 'Matemáticas');
  assert.equal(data.size, 1);
});

test('US-06: las salas inactivas se ocultan incluso al propietario y al participante', async () => {
  const { client, store } = await fixture();
  const inactiveDocument: unknown = { ...sample('ana', ['ana', 'bea']), roomId, status: 'inactive' };
  // Simula un documento externo al contrato de escritura REST, como lo leería el adaptador.
  store.read = async id => id === roomId ? inactiveDocument as Room : undefined;
  for (const uid of ['ana', 'bea', 'carlos']) {
    for (const id of [roomId, otherRoomId]) {
      await client.get(`${path}/${id}`).auth(uid, { type: 'bearer' })
        .expect(404, { error: 'Sala no encontrada' });
    }
  }
});

test('US-06: GET aplica el filtro de Firestore y limita el listado a 50 IDs ordenados', async () => {
  const { client, store } = await fixture();
  const ids = Array.from({ length: 53 }, (_, i) => `A${String(i).padStart(19, '0')}`);
  const ownRooms = ids.map(id => ({ ...sample(), roomId: id })).reverse();
  const documents = [...ownRooms, { ...sample('bea', ['bea', 'ana']), roomId: otherRoomId }];
  const db = {
    collection(name: string) {
      assert.equal(name, 'rooms');
      return {
        where(field: string, operator: string, uid: string) {
          assert.deepEqual([field, operator, uid], ['ownerUid', '==', 'ana']);
          return {
            limit(count: number) {
              assert.equal(count, 50);
              return {
                async get() {
                  // El doble reproduce el orden por ID del índice con ownerUid fijo.
                  const selected = documents.filter(room => room.ownerUid === uid)
                    .sort((a, b) => a.roomId < b.roomId ? -1 : 1).slice(0, count);
                  return { docs: selected.map(({ roomId: id, ...doc }) => ({ id, data: () => doc })) };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Firestore;
  store.listOwned = createRoomStore(() => db).listOwned;
  const { body } = await client.get(path).auth('ana', { type: 'bearer' }).expect(200);
  assert.deepEqual(body.rooms.map((room: Room) => room.roomId), ids.slice(0, 50));
  assert.ok(body.rooms.every((room: Room) => room.ownerUid === 'ana'));
});

test('US-06: crear, listar y consultar sanitizan errores de Firestore', async () => {
  const { client, store, data } = await fixture();
  for (const [code, status, error] of [
    [7, 500, 'Error interno del servidor'],
    [14, 503, 'Servicio temporalmente no disponible'],
  ] as const) {
    const fail = async () => { throw { code, message: 'DETALLE_INTERNO_SIMULADO' }; };
    store.create = store.listOwned = store.read = fail;
    await client.post(path).auth('ana', { type: 'bearer' }).send({ name: 'Matemáticas' }).expect(status, { error });
    await client.get(path).auth('ana', { type: 'bearer' }).expect(status, { error });
    await client.get(`${path}/${roomId}`).auth('ana', { type: 'bearer' }).expect(status, { error });
  }
  assert.equal(data.size, 0);
});

// US-07: Pruebas de ingreso a salas.

test('US-07: permite ingresar a una sala existente', async () => {
  const { client, data } = await fixture();

  data.set(roomId, { ...sample(), roomId });

  const response = await client
    .post(`${path}/${roomId}/join`)
    .auth('bea', { type: 'bearer' })
    .expect(200);

  assert.equal(response.body.roomId, roomId);
  assert.equal(response.body.ownerUid, 'ana');
  assert.deepEqual(response.body.participantUids, ['ana', 'bea']);
  assert.deepEqual(data.get(roomId)?.participantUids, ['ana', 'bea']);

  await client
    .get(`${path}/${roomId}`)
    .auth('bea', { type: 'bearer' })
    .expect(200);
});

test('US-07: ingresar varias veces no duplica participantes', async () => {
  const { client, data } = await fixture();

  data.set(roomId, { ...sample(), roomId });

  for (let i = 0; i < 3; i++) {
    await client
      .post(`${path}/${roomId}/join`)
      .auth('bea', { type: 'bearer' })
      .expect(200);
  }

  assert.deepEqual(data.get(roomId)?.participantUids, ['ana', 'bea']);
});

test('US-07: permite registrar varios participantes', async () => {
  const { client, data } = await fixture();

  data.set(roomId, { ...sample(), roomId });

  for (const uid of ['bea', 'carlos']) {
    await client
      .post(`${path}/${roomId}/join`)
      .auth(uid, { type: 'bearer' })
      .expect(200);
  }

  assert.deepEqual(
    data.get(roomId)?.participantUids,
    ['ana', 'bea', 'carlos']
  );
});

test('US-07: rechaza una sala inexistente', async () => {
  const { client, data } = await fixture();

  await client
    .post(`${path}/${otherRoomId}/join`)
    .auth('bea', { type: 'bearer' })
    .expect(404, { error: 'Sala no encontrada' });

  assert.equal(data.size, 0);
});

test('US-07: rechaza identificadores inválidos', async () => {
  const { client } = await fixture();

  for (const id of ['invalido', '%FF']) {
    await client
      .post(`${path}/${id}/join`)
      .auth('bea', { type: 'bearer' })
      .expect(400);
  }
});

test('US-07: requiere autenticación válida', async () => {
  const { client, data } = await fixture();

  data.set(roomId, { ...sample(), roomId });

  await client
    .post(`${path}/${roomId}/join`)
    .expect(401);

  for (const token of ['invalid', 'expired', 'revoked', 'deleted']) {
    await client
      .post(`${path}/${roomId}/join`)
      .auth(token, { type: 'bearer' })
      .expect(401);
  }

  assert.deepEqual(data.get(roomId)?.participantUids, ['ana']);
});

test('US-07: rechaza perfiles incompletos y otros tenants', async () => {
  const { client, data } = await fixture();

  data.set(roomId, { ...sample(), roomId });

  for (const token of ['incompleto', 'sinperfil', 'tenant']) {
    await client
      .post(`${path}/${roomId}/join`)
      .auth(token, { type: 'bearer' })
      .expect(403);
  }

  assert.deepEqual(data.get(roomId)?.participantUids, ['ana']);
});

test('US-07: rechaza el ingreso a salas inactivas', async () => {
  const { client, data } = await fixture();

  const inactiveDocument: unknown = {
    ...sample(),
    roomId,
    status: 'inactive',
  };

  data.set(roomId, inactiveDocument as Room);

  await client
    .post(`${path}/${roomId}/join`)
    .auth('bea', { type: 'bearer' })
    .expect(404, { error: 'Sala no encontrada' });

  assert.deepEqual(data.get(roomId)?.participantUids, ['ana']);
});

test('US-07: sanitiza errores de Firestore al ingresar', async () => {
  const { client, store } = await fixture();

  store.join = async () => {
    throw {
      code: 14,
      message: 'DETALLE_INTERNO_SIMULADO',
    };
  };

  await client
    .post(`${path}/${roomId}/join`)
    .auth('bea', { type: 'bearer' })
    .expect(503, {
      error: 'Servicio temporalmente no disponible',
    });
});

test('US-07: la ruta de ingreso está montada en la aplicación principal', async () => {
  await request(app)
    .post(`${path}/${roomId}/join`)
    .expect(401);
});

// US-10: Pruebas de edición de salas.

test('US-10: permite al anfitrión editar el nombre de su sala', async () => {
  const { client, data } = await fixture();

  const original = {
    ...sample('ana', ['ana', 'bea']),
    roomId,
  };

  data.set(roomId, original);

  const response = await client
    .patch(`${path}/${roomId}`)
    .auth('ana', { type: 'bearer' })
    .send({ name: '  Programación avanzada  ' })
    .expect(200);

  assert.deepEqual(response.body, {
    ...original,
    name: 'Programación avanzada',
    createdAt: original.createdAt.toDate().toISOString(),
  });

  assert.deepEqual(data.get(roomId), {
    ...original,
    name: 'Programación avanzada',
  });
});

test('US-10: el participante puede consultar el nombre actualizado', async () => {
  const { client, data } = await fixture();

  data.set(roomId, {
    ...sample('ana', ['ana', 'bea']),
    roomId,
  });

  await client
    .patch(`${path}/${roomId}`)
    .auth('ana', { type: 'bearer' })
    .send({ name: 'Ingeniería de software' })
    .expect(200);

  const response = await client
    .get(`${path}/${roomId}`)
    .auth('bea', { type: 'bearer' })
    .expect(200);

  assert.equal(
    response.body.name,
    'Ingeniería de software'
  );
});

test('US-10: rechaza la edición por usuarios que no son anfitriones', async () => {
  const { client, data } = await fixture();

  const original = {
    ...sample('ana', ['ana', 'bea']),
    roomId,
  };

  data.set(roomId, original);

  for (const uid of ['bea', 'carlos']) {
    await client
      .patch(`${path}/${roomId}`)
      .auth(uid, { type: 'bearer' })
      .send({ name: 'Nombre no autorizado' })
      .expect(403, {
        error: 'Solo el anfitrión puede editar la sala',
      });
  }

  assert.deepEqual(data.get(roomId), original);
});

test('US-10: rechaza la edición de salas inexistentes', async () => {
  const { client, data } = await fixture();

  await client
    .patch(`${path}/${otherRoomId}`)
    .auth('ana', { type: 'bearer' })
    .send({ name: 'Nueva sala' })
    .expect(404, {
      error: 'Sala no encontrada',
    });

  assert.equal(data.size, 0);
});

test('US-10: rechaza la edición de salas inactivas', async () => {
  const { client, data } = await fixture();

  const inactiveDocument: unknown = {
    ...sample(),
    roomId,
    status: 'inactive',
  };

  data.set(roomId, inactiveDocument as Room);

  await client
    .patch(`${path}/${roomId}`)
    .auth('ana', { type: 'bearer' })
    .send({ name: 'Nuevo nombre' })
    .expect(404, {
      error: 'Sala no encontrada',
    });

  assert.equal(data.get(roomId)?.name, 'Matemáticas');
});

test('US-10: rechaza identificadores de sala inválidos', async () => {
  const { client } = await fixture();

  for (const id of ['invalido', '%FF']) {
    await client
      .patch(`${path}/${id}`)
      .auth('ana', { type: 'bearer' })
      .send({ name: 'Nuevo nombre' })
      .expect(400);
  }
});

test('US-10: rechaza nombres inválidos', async () => {
  const { client, data } = await fixture();

  data.set(roomId, {
    ...sample(),
    roomId,
  });

  for (const body of [
    {},
    [],
    { name: 123 },
    { name: null },
    { name: '' },
    { name: '   ' },
    { name: 'a'.repeat(101) },
  ]) {
    await client
      .patch(`${path}/${roomId}`)
      .auth('ana', { type: 'bearer' })
      .send(body)
      .expect(400);
  }

  assert.equal(data.get(roomId)?.name, 'Matemáticas');
});

test('US-10: impide modificar campos protegidos de la sala', async () => {
  const { client, data } = await fixture();

  const original = {
    ...sample('ana', ['ana', 'bea']),
    roomId,
  };

  data.set(roomId, original);

  for (const extra of [
    { ownerUid: 'bea' },
    { participantUids: ['carlos'] },
    { status: 'inactive' },
    { createdAt: '2000-01-01' },
    { roomId: otherRoomId },
  ]) {
    await client
      .patch(`${path}/${roomId}`)
      .auth('ana', { type: 'bearer' })
      .send({
        name: 'Nuevo nombre',
        ...extra,
      })
      .expect(400);
  }

  assert.deepEqual(data.get(roomId), original);
});

test('US-10: requiere autenticación válida', async () => {
  const { client, data } = await fixture();

  data.set(roomId, {
    ...sample(),
    roomId,
  });

  await client
    .patch(`${path}/${roomId}`)
    .send({ name: 'Nuevo nombre' })
    .expect(401);

  for (const token of [
    'invalid',
    'expired',
    'revoked',
    'deleted',
  ]) {
    await client
      .patch(`${path}/${roomId}`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Nuevo nombre' })
      .expect(401);
  }

  assert.equal(data.get(roomId)?.name, 'Matemáticas');
});

test('US-10: rechaza perfiles incompletos y otros tenants', async () => {
  const { client, data } = await fixture();

  data.set(roomId, {
    ...sample(),
    roomId,
  });

  for (const token of [
    'incompleto',
    'sinperfil',
    'tenant',
  ]) {
    await client
      .patch(`${path}/${roomId}`)
      .auth(token, { type: 'bearer' })
      .send({ name: 'Nuevo nombre' })
      .expect(403);
  }

  assert.equal(data.get(roomId)?.name, 'Matemáticas');
});

test('US-10: sanitiza errores de Firestore al editar', async () => {
  const { client, store } = await fixture();

  for (const [code, status, error] of [
    [7, 500, 'Error interno del servidor'],
    [14, 503, 'Servicio temporalmente no disponible'],
  ] as const) {
    store.update = async () => {
      throw {
        code,
        message: 'DETALLE_INTERNO_SIMULADO',
      };
    };

    await client
      .patch(`${path}/${roomId}`)
      .auth('ana', { type: 'bearer' })
      .send({ name: 'Nuevo nombre' })
      .expect(status, { error });
  }
});

test('US-10: la ruta de edición está montada en la aplicación principal', async () => {
  await request(app)
    .patch(`${path}/${roomId}`)
    .send({ name: 'Nuevo nombre' })
    .expect(401);
});

test('US-10: el adaptador Firestore verifica al anfitrión dentro de la transacción', async () => {
  let document: RoomDocument | undefined =
    sample('ana', ['ana', 'bea']);

  let writes = 0;
  let transactions = 0;

  const ref = { id: roomId };

  const db = {
    collection(name: string) {
      assert.equal(name, 'rooms');

      return {
        doc(id: string) {
          assert.equal(id, roomId);
          return ref;
        },
      };
    },

    async runTransaction<T>(
      operation: (transaction: {
        get: (target: unknown) => Promise<{
          id: string;
          data: () => RoomDocument | undefined;
        }>;
        update: (
          target: unknown,
          changes: Partial<RoomDocument>
        ) => void;
      }) => Promise<T>
    ): Promise<T> {
      transactions++;

      return operation({
        async get(target) {
          assert.equal(target, ref);

          return {
            id: roomId,
            data: () => document,
          };
        },

        update(target, changes) {
          assert.equal(target, ref);
          assert.deepEqual(
            Object.keys(changes),
            ['name']
          );

          assert.ok(document);

          document = {
            ...document,
            ...changes,
          };

          writes++;
        },
      });
    },
  } as unknown as Firestore;

  const store = createRoomStore(() => db);

  // Un participante no puede editar.
  const forbidden = await store.update(
    roomId,
    'bea',
    'Cambio no autorizado'
  );

  assert.deepEqual(forbidden, {
    status: 'forbidden',
  });

  assert.equal(writes, 0);

  // El anfitrión puede editar.
  const updated = await store.update(
    roomId,
    'ana',
    'Programación avanzada'
  );

  assert.equal(updated.status, 'updated');
  assert.equal(document?.name, 'Programación avanzada');
  assert.equal(document?.ownerUid, 'ana');

  assert.deepEqual(
    document?.participantUids,
    ['ana', 'bea']
  );

  assert.equal(writes, 1);

  // Una sala inexistente no puede editarse.
  document = undefined;

  const missing = await store.update(
    roomId,
    'ana',
    'Otra sala'
  );

  assert.deepEqual(missing, {
    status: 'not_found',
  });

  assert.equal(writes, 1);
  assert.equal(transactions, 3);
});
