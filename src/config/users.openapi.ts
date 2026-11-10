import type { OpenAPIV3 } from 'openapi-types';
import { AVATAR_IDS } from './avatars';

const editable: Record<string, OpenAPIV3.SchemaObject> = {
  firstName: { type: 'string', nullable: true, minLength: 1, maxLength: 100, description: 'Se recortan los espacios de los extremos; null solo mientras el perfil esté incompleto.' },
  lastName: { type: 'string', nullable: true, minLength: 1, maxLength: 100, description: 'Se recortan los espacios de los extremos; null solo mientras el perfil esté incompleto.' },
  username: { type: 'string', nullable: true, pattern: '^[A-Za-z0-9_]{3,20}$', description: 'Unicidad sin distinguir mayúsculas. No se puede limpiar un nombre ya elegido.' },
  avatarId: { type: 'string', enum: [...AVATAR_IDS], description: 'Predeterminado al crear: avatar_book.' },
};
export const usersSchemas: Record<string, OpenAPIV3.SchemaObject> = {
  ProfileInput: { type: 'object', additionalProperties: false, properties: editable, description: 'Todos los campos son opcionales para permitir alta por pasos. PATCH conserva los campos omitidos. Se rechazan campos administrados por el servidor.' },
  Profile: {
    type: 'object', additionalProperties: false,
    required: [...Object.keys(editable), 'usernameNormalized', 'email', 'authProvider', 'profileCompleted', 'createdAt', 'updatedAt'],
    properties: {
      ...editable,
      usernameNormalized: { type: 'string', nullable: true }, email: { type: 'string', format: 'email' },
      authProvider: { type: 'string', enum: ['password', 'google.com'] }, profileCompleted: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
    },
  },
};
const errors: Record<string, OpenAPIV3.ResponseObject> = Object.fromEntries(Object.entries({
  '400': 'Datos inválidos o correo ausente en el token', '401': 'Token ausente, inválido, expirado o revocado',
  '403': 'Proveedor no permitido', '404': 'Perfil no encontrado', '409': 'Nombre ocupado, perfil existente o datos inconsistentes',
  '500': 'Error interno del servidor', '503': 'Servicio temporalmente no disponible',
}).map(([status, description]) => [status, { description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }]));
function operation(method: string, summary: string, status: string, input = false): OpenAPIV3.OperationObject {
  return {
    operationId: `${method}OwnProfile`, tags: ['Perfiles'], summary,
    description: method === 'delete' ? 'Elimina solo el perfil y libera su nombre atómicamente. No elimina la cuenta Firebase Authentication. Idempotente si no quedan reservas.' : 'Opera exclusivamente sobre el UID del token verificado con comprobación de revocación. Las fechas se devuelven como ISO; se almacenan como Timestamp.',
    security: [{ bearerAuth: [] }],
    ...(input ? { requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileInput' }, example: { firstName: 'Ana', lastName: 'Perez', username: 'Ana_01', avatarId: 'avatar_book' } } } } } : {}),
    responses: { ...errors, [status]: status === '204' ? { description: 'Perfil eliminado; sin cuerpo' } : {
      description: 'Perfil propio', content: { 'application/json': { schema: { $ref: '#/components/schemas/Profile' } } },
    } },
  };
}
export const usersPath: OpenAPIV3.PathItemObject = {
  post: operation('create', 'Crear perfil propio', '201', true),
  get: operation('read', 'Consultar perfil propio', '200'),
  patch: operation('update', 'Actualizar perfil propio', '200', true),
  delete: operation('delete', 'Eliminar perfil propio', '204'),
};
