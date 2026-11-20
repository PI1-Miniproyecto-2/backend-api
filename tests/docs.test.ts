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
    for (const code of [status, '400', '401', '403', '409', '500', '503']) assert.ok(path[method].responses[code]);
    if (method !== 'delete') assert.ok(path[method].responses['404']);
  }
  for (const method of ['post', 'patch']) assert.ok(path[method].requestBody.required);
  assert.equal(path.delete.responses['204'].content, undefined);
  assert.deepEqual(Object.keys(spec.components.schemas.ProfileInput.properties).sort(), ['avatarId', 'firstName', 'lastName', 'username']);
  assert.equal(spec.components.schemas.ProfileInput.additionalProperties, false);
  assert.equal(spec.paths['/health'].get.security, undefined);
  await request(app).get('/api/v1/users/me').expect(401);
  await request(app).get('/api/v1/system/firestore-status').expect(403);
});


test('US-04: Swagger describe edición parcial, cuerpo vacío y recuperación con GET', async () => {
  const { body: spec } = await request(app).get('/openapi.json').expect(200);
  const { get, patch } = spec.paths['/api/v1/users/me'];
  assert.equal(spec.components.securitySchemes.bearerAuth.bearerFormat, 'Firebase ID token');
  assert.match(get.description, /exclusivamente sobre el UID del token verificado/);
  assert.match(patch.description, /campos editables omitidos conservan su valor/);
  assert.match(patch.description, /servidor administra uid, email, authProvider, usernameNormalized, createdAt, updatedAt y profileCompleted/);
  assert.match(patch.description, /cero bytes se rechaza con 400/);
  assert.match(patch.description, /JSON explícito \`\{\}\`.*sincronizar email, authProvider y updatedAt/);
  assert.match(patch.description, /lectura posterior a una escritura confirmada.*error.*guardados/);
  assert.match(patch.description, /consultar GET \/api\/v1\/users\/me antes de repetir PATCH/);
  assert.equal(patch.requestBody.content['application/json'].schema.$ref, '#/components/schemas/ProfileInput');
  const { username } = spec.components.schemas.ProfileInput.properties;
  assert.equal(username.pattern, '^[A-Za-z0-9_]{3,20}$');
  assert.match(username.description, /Unicidad sin distinguir mayúsculas/);
});

test('US-05: Swagger describe la eliminación confirmada y los reintentos', async () => {
  const { body: spec } = await request(app).get('/openapi.json').expect(200);
  const operation = spec.paths['/api/v1/users/me'].delete;
  assert.equal(operation.summary, 'Eliminar la cuenta propia');
  assert.equal(operation.requestBody, undefined);
  assert.equal(operation.parameters, undefined);
  assert.deepEqual(Object.keys(operation.responses), ['204', '400', '401', '403', '408', '409', '500', '503']);
  assert.match(operation.responses['408'].description, /cinco segundos.*chunked.*parser JSON/);
  assert.match(operation.description, /UID del token verificado.*máximo de cinco minutos.*auth_time/);
  assert.match(operation.description, /No admite cuerpo ni parámetros de consulta/);
  assert.match(operation.description, /elimina el perfil.*libera la reserva.*marca persistente.*identidad de Firebase Auth.*no es atómica/);
  assert.match(operation.description, /reintentar mientras la identidad siga autenticada/);
  assert.match(operation.description, /401.*desconexión no confirma por sí solo/);
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

test('US-06: OpenAPI documenta las tres operaciones de salas y sus respuestas reales', async () => {
  const { body: spec } = await request(app).get('/openapi.json').expect(200);
  const collection = spec.paths['/api/v1/rooms'];
  const item = spec.paths['/api/v1/rooms/{roomId}'];
  assert.deepEqual(Object.keys(collection).sort(), ['get', 'post']);
  assert.deepEqual(Object.keys(item), ['get']);
  assert.ok(spec.tags.some((tag: { name: string }) => tag.name === 'Salas'));
  assert.deepEqual(spec.components.securitySchemes.bearerAuth,
    { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID token' });
  for (const [operation, codes] of [
    [collection.post, ['201', '400', '401', '403', '409', '500', '503']],
    [collection.get, ['200', '400', '401', '403', '409', '500', '503']],
    [item.get, ['200', '400', '401', '403', '404', '409', '500', '503']],
  ] as const) {
    assert.ok(operation.summary);
    assert.deepEqual(operation.tags, ['Salas']);
    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    assert.deepEqual(Object.keys(operation.responses), codes);
    assert.match(operation.description, /revocación.*perfil completo.*otros tenants/);
  }

  const json = 'application/json';
  assert.equal(collection.post.requestBody.required, true);
  assert.equal(collection.post.requestBody.content[json].schema.$ref, '#/components/schemas/CreateRoomInput');
  assert.deepEqual(collection.post.requestBody.content[json].example, { name: 'Estudio de Matemáticas' });
  assert.equal(collection.get.requestBody, undefined);
  assert.equal(item.get.requestBody, undefined);
  const [parameter] = item.get.parameters;
  assert.equal(item.get.parameters.length, 1);
  assert.equal(parameter.name, 'roomId');
  assert.equal(parameter.in, 'path');
  assert.equal(parameter.required, true);
  assert.equal(parameter.schema.type, 'string');
  assert.equal(parameter.schema.pattern, '^[A-Za-z0-9]{20}$');
  assert.match(parameter.schema.example, new RegExp(parameter.schema.pattern));

  const { CreateRoomInput, Room, RoomListResponse } = spec.components.schemas;
  assert.deepEqual(CreateRoomInput.required, ['name']);
  assert.deepEqual(Object.keys(CreateRoomInput.properties), ['name']);
  assert.equal(CreateRoomInput.additionalProperties, false);
  assert.match(CreateRoomInput.properties.name.description, /100 unidades UTF-16/);
  assert.deepEqual(Room.required, ['roomId', 'name', 'ownerUid', 'participantUids', 'createdAt', 'status']);
  assert.equal(Room.properties.createdAt.format, 'date-time');
  assert.deepEqual(Room.properties.status.enum, ['active']);
  assert.deepEqual(RoomListResponse.required, ['rooms']);
  assert.equal(RoomListResponse.properties.rooms.maxItems, 50);
  assert.equal(RoomListResponse.properties.rooms.items.$ref, '#/components/schemas/Room');
  assert.equal(collection.post.responses['201'].content[json].schema.$ref, '#/components/schemas/Room');
  assert.equal(collection.get.responses['200'].content[json].schema.$ref, '#/components/schemas/RoomListResponse');
  assert.equal(item.get.responses['200'].content[json].schema.$ref, '#/components/schemas/Room');
  assert.match(collection.get.description, /50 salas propias.*orden ascendente por roomId.*Sin paginación/);
  assert.match(item.get.description, /activa.*propietario o figurar en participantUids/);
  const notFound = item.get.responses['404'];
  assert.match(notFound.description, /inexistente, inactiva o sin autorización/);
  assert.deepEqual(notFound.content[json].example, { error: 'Sala no encontrada' });
});
