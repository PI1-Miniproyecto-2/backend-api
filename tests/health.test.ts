import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { app } from '../src/app';
import { parsePort } from '../src/config/env';

test('GET /health responde 200 y status ok en JSON', async () => {
  const response = await request(app).get('/health').expect(200).expect('Content-Type', /json/);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('una ruta desconocida responde 404 en JSON', async () => {
  const response = await request(app).get('/missing').expect(404);
  assert.deepEqual(response.body, { error: 'Ruta no encontrada' });
});

test('un JSON inválido responde 400', async () => {
  const response = await request(app).post('/health').set('Content-Type', 'application/json').send('{').expect(400);
  assert.deepEqual(response.body, { error: 'JSON inválido' });
});

test('PORT usa 3000 por defecto y valida el rango', () => {
  assert.equal(parsePort(undefined), 3000);
  assert.equal(parsePort('8080'), 8080);
  for (const value of ['', '0', '65536', '3000abc', '3.5']) {
    assert.throws(() => parsePort(value));
  }
});
