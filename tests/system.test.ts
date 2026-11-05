import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { app } from '../src/app';

test('GET /api/v1/system/status responde 200 con el estado y servicio en JSON', async () => {
  const response = await request(app)
    .get('/api/v1/system/status')
    .expect(200)
    .expect('Content-Type', /json/);

  assert.deepEqual(response.body, { status: 'ok', service: 'backend-api' });
});

test('POST /api/v1/system/status responde 404 según el comportamiento actual', async () => {
  const response = await request(app)
    .post('/api/v1/system/status')
    .expect(404)
    .expect('Content-Type', /json/);

  assert.deepEqual(response.body, { error: 'Ruta no encontrada' });
});

test('una ruta de sistema inexistente responde 404 en JSON', async () => {
  const response = await request(app)
    .get('/api/v1/system/missing')
    .expect(404)
    .expect('Content-Type', /json/);

  assert.deepEqual(response.body, { error: 'Ruta no encontrada' });
});
