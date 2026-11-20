import type { OpenAPIV3 } from 'openapi-types';

const roomId: OpenAPIV3.SchemaObject = {
  type: 'string', pattern: '^[A-Za-z0-9]{20}$', example: 'A1234567890123456789',
};
const name: OpenAPIV3.SchemaObject = {
  type: 'string',
  description: 'El servidor recorta los espacios de los extremos. El resultado debe tener de 1 a 100 unidades UTF-16.',
};
const inputExample = { name: 'Estudio de Matemáticas' };
const roomExample = {
  roomId: roomId.example,
  ...inputExample,
  ownerUid: 'uid-ana',
  participantUids: ['uid-ana'],
  createdAt: '2026-11-19T14:00:00.000Z',
  status: 'active',
};

export const roomsSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  CreateRoomInput: {
    type: 'object', additionalProperties: false, required: ['name'], properties: { name },
  },
  Room: {
    type: 'object',
    additionalProperties: false,
    required: ['roomId', 'name', 'ownerUid', 'participantUids', 'createdAt', 'status'],
    properties: {
      roomId,
      name,
      ownerUid: { type: 'string' },
      participantUids: { type: 'array', items: { type: 'string' } },
      createdAt: { type: 'string', format: 'date-time', description: 'Fecha ISO 8601. Firestore la almacena como Timestamp.' },
      status: { type: 'string', enum: ['active'] },
    },
  },
  RoomListResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['rooms'],
    properties: {
      rooms: { type: 'array', maxItems: 50, items: { $ref: '#/components/schemas/Room' } },
    },
  },
};

function json(schema: string, example: unknown) {
  return { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` }, example } };
}

function error(description: string, message: string): OpenAPIV3.ResponseObject {
  return { description, content: json('Error', { error: message }) };
}

const access = 'Requiere un Firebase ID token con verificación de revocación y un perfil completo. Se rechazan identidades de otros tenants.';
const common = {
  tags: ['Salas'],
  security: [{ bearerAuth: [] }],
};
const errors = {
  '401': error('Token ausente, inválido, expirado o revocado, o identidad deshabilitada o eliminada.', 'Token inválido, expirado o revocado'),
  '403': error('Perfil incompleto o ausente, proveedor no permitido o identidad de otro tenant.', 'Debe completar su perfil'),
  '409': error('El perfil o su reserva de nombre de usuario presenta una inconsistencia.', 'Perfil o reserva inconsistente; requiere reconciliación'),
  '500': { $ref: '#/components/responses/InternalError' },
  '503': error('Firebase Auth o Firestore no está disponible temporalmente.', 'Servicio temporalmente no disponible'),
};

export const roomsPath: OpenAPIV3.PathItemObject = {
  post: {
    ...common,
    operationId: 'createRoom',
    summary: 'Crear una sala de estudio',
    description: `${access} Acepta únicamente name. El servidor genera el ID, toma ownerUid del token, registra solo al creador en participantUids y establece createdAt y status.`,
    requestBody: { required: true, content: json('CreateRoomInput', inputExample) },
    responses: {
      '201': { description: 'Sala creada.', content: json('Room', roomExample) },
      '400': error('JSON malformado, cuerpo ausente, nombre inválido o propiedades adicionales.', 'El cuerpo debe contener únicamente el campo name como texto'),
      ...errors,
    },
  },
  get: {
    ...common,
    operationId: 'listOwnRooms',
    summary: 'Listar las salas propias',
    description: `${access} Devuelve hasta 50 salas propias en orden ascendente por roomId. El filtro usa ownerUid, por lo que no incluye salas de terceros donde el usuario participa. Sin paginación. Si no hay salas propias, devuelve un arreglo vacío.`,
    responses: {
      '200': { description: 'Salas del propietario autenticado.', content: json('RoomListResponse', { rooms: [roomExample] }) },
      '400': { $ref: '#/components/responses/InvalidJson' },
      ...errors,
    },
  },
};

export const roomPath: OpenAPIV3.PathItemObject = {
  get: {
    ...common,
    operationId: 'getRoom',
    summary: 'Consultar una sala por ID',
    description: `${access} La sala debe estar activa y el UID debe ser el del propietario o figurar en participantUids. Conocer el ID no otorga acceso.`,
    parameters: [{
      name: 'roomId', in: 'path', required: true, schema: roomId,
      description: 'ID automático alfanumérico de Firestore de 20 caracteres.',
    }],
    responses: {
      '200': { description: 'Sala activa accesible a la identidad autenticada.', content: json('Room', roomExample) },
      '400': error('Identificador de sala inválido o JSON malformado si se envía un cuerpo.', 'Identificador de sala inválido'),
      ...errors,
      '404': error('Sala inexistente, inactiva o sin autorización. Los tres casos devuelven la misma respuesta.', 'Sala no encontrada'),
    },
  },
};
