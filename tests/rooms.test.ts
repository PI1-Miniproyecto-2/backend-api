import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { app, parseJson } from '../src/app';
import { errorHandler, notFound } from '../src/middlewares/error.middleware';
import type { Room, RoomDocument } from '../src/models/room';
import { createRoomsRoutes } from '../src/routes/rooms.routes';
import { createAuthService } from '../src/services/auth.service';
import { createProfileService } from '../src/services/profile.service';
import { createRoomService } from '../src/services/room.service';
import { ROOM_LIST_LIMIT, type RoomStore } from '../src/services/room.store';
import { MemoryStore } from './helpers/memory-store';

const path = '/api/v1/rooms';
const roomId = 'A1234567890123456789';
const otherRoomId = 'B1234567890123456789';

async function fixture() {
  const data = new Map<string, Room>();
  const profiles = createProfileService(new MemoryStore());
  const auth = createAuthService(async (token, checkRevoked) => {
    assert.equal(checkRevoked, true);
    return { uid: token, firebase: { sign_in_provider: 'password' } } as DecodedIdToken;
  });
  for (const uid of ['ana', 'bea', 'carlos']) {
    await profiles.create({ uid, email: `${uid}@example.com`, provider: 'password' }, {
      firstName: uid, lastName: 'Pérez', username: `${uid}_01`,
    });
  }

  const store: RoomStore = {
    async create(doc) {
      data.set(roomId, { ...doc, roomId });
      return roomId;
    },
    async listOwned(uid) {
      return [...data.keys()].sort().map(id => data.get(id)!)
        .filter(room => room.ownerUid === uid).slice(0, ROOM_LIST_LIMIT);
    },
    async read(id) { return data.get(id); },
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
