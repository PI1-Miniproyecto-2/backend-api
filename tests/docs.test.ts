import assert from 'node:assert/strict';
import { test } from 'node:test';
import SwaggerParser from '@apidevtools/swagger-parser';
import request from 'supertest';
import { app } from '../src/app';

test('Swagger UI está disponible con sus recursos locales', async () => {
  const response = await request(app).get('/api-docs').redirects(1)
    .expect(200).expect('Content-Type', /html/);
  assert.match(response.text, /Swagger UI/);
  await request(app).get('/api-docs/swagger-ui.css').expect(200).expect('Content-Type', /css/);
  const init = await request(app).get('/api-docs/swagger-ui-init.js').expect(200);
  assert.match(init.text, /\/openapi\.json/);
});

test('GET /openapi.json devuelve una especificación OpenAPI 3.0 válida', async () => {
  const response = await request(app).get('/openapi.json')
    .expect(200).expect('Content-Type', /json/);
  const spec = response.body;
  assert.equal(spec.openapi, '3.0.3');
  assert.ok(spec.info.title);
  assert.equal(spec.info.version, '0.1.0');
  assert.equal(spec.servers[0].url, '/');
  assert.deepEqual(spec.paths['/health'].get.responses['200'].content['application/json'].example,
    { status: 'ok' });
  assert.deepEqual(spec.paths['/api/v1/system/status'].get.responses['200'].content['application/json'].example,
    { status: 'ok', service: 'backend-api' });
  assert.match(spec.paths['/api/v1/system/status'].get.description, /TS-00-T06/);
  // Solo referencias internas; la validación no necesita red ni credenciales.
  await SwaggerParser.validate(spec, { resolve: { external: false } });
});

test('GET /api/v1/system/status coincide con la documentación OpenAPI', async () => {
  const response = await request(app)
    .get('/api/v1/system/status')
    .expect(200);

  assert.deepEqual(response.body, {
    status: 'ok',
    service: 'backend-api',
  });

  const spec = await request(app)
    .get('/openapi.json')
    .expect(200);

  assert.ok(spec.body.paths['/api/v1/system/status']);
  assert.ok(
    spec.body.paths['/api/v1/system/status'].get.responses['200']
  );
});

test('OpenAPI documenta CRUD propio, seguridad, campos y errores de TS-01', async () => {
  const { body: spec } = await request(app).get('/openapi.json').expect(200);
  const path = spec.paths['/api/v1/users/me'];
  assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');
  for (const [method, status] of [['post', '201'], ['get', '200'], ['patch', '200'], ['delete', '204']]) {
    assert.deepEqual(path[method].security, [{ bearerAuth: [] }]);
    for (const code of [status, '400', '401', '403', '404', '409', '500', '503']) assert.ok(path[method].responses[code]);
  }
  for (const method of ['post', 'patch']) assert.ok(path[method].requestBody.required);
  assert.equal(path.delete.responses['204'].content, undefined);
  assert.deepEqual(Object.keys(spec.components.schemas.ProfileInput.properties).sort(), ['avatarId', 'firstName', 'lastName', 'username']);
  assert.equal(spec.components.schemas.ProfileInput.additionalProperties, false);
  assert.equal(spec.paths['/health'].get.security, undefined);
  await request(app).get('/api/v1/users/me').expect(401);
  await request(app).get('/api/v1/system/firestore-status').expect(403);
});


test('US-01: Swagger distingue creación de cuenta Firebase y creación de perfil', async () => {
  const { body: spec } = await request(app).get('/openapi.json').expect(200);
  const post = spec.paths['/api/v1/users/me'].post;
  assert.match(post.description, /frontend.*Firebase Authentication/);
  assert.match(post.description, /correo y proveedor proceden del token/);
  assert.match(post.description, /No enviar contraseñas/);
  assert.deepEqual(post.security, [{ bearerAuth: [] }]);
  assert.equal(spec.components.schemas.ProfileInput.properties.password, undefined);
});
