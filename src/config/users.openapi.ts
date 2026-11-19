import type { OpenAPIV3 } from 'openapi-types';
import { AVATAR_IDS } from './avatars';

const editable: Record<string, OpenAPIV3.SchemaObject> = {
  firstName: { type: 'string', nullable: true, minLength: 1, maxLength: 100, description: 'Se recortan los espacios de los extremos; null solo mientras el perfil esté incompleto.' },
  lastName: { type: 'string', nullable: true, minLength: 1, maxLength: 100, description: 'Se recortan los espacios de los extremos; null solo mientras el perfil esté incompleto.' },
  username: { type: 'string', nullable: true, pattern: '^[A-Za-z0-9_]{3,20}$', description: 'De 3 a 20 caracteres: letras ASCII, números y guion bajo. Unicidad sin distinguir mayúsculas. No se puede limpiar un nombre ya elegido.' },
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
const errorResponse = (description: string): OpenAPIV3.ResponseObject => ({
  description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});
const errors: Record<string, OpenAPIV3.ResponseObject> = Object.fromEntries(Object.entries({
  '400': 'Datos inválidos o correo ausente en el token', '401': 'Token ausente, inválido, expirado o revocado',
  '403': 'Proveedor no permitido', '404': 'Perfil no encontrado', '409': 'Nombre ocupado, perfil existente o datos inconsistentes',
  '500': 'Error interno del servidor', '503': 'Servicio temporalmente no disponible',
}).map(([status, description]) => [status, errorResponse(description)]));
function operation(method: string, summary: string, status: string, input = false): OpenAPIV3.OperationObject {
  return {
    operationId: `${method}OwnProfile`, tags: ['Perfiles'], summary,
    description: method === 'create' ? 'Registro manual: el frontend crea la cuenta con correo y contraseña en Firebase Authentication y obtiene un ID token. Esta operación crea únicamente el perfil del UID verificado; correo y proveedor proceden del token. No enviar contraseñas ni correo en el cuerpo. Admite perfil incompleto para alta por pasos. Si la respuesta falla después del commit, consultar GET antes de repetir POST.' : 'Opera exclusivamente sobre el UID del token verificado con comprobación de revocación. Las fechas se devuelven como ISO; se almacenan como Timestamp.',
    security: [{ bearerAuth: [] }],
    ...(input ? { requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileInput' }, example: { firstName: 'Ana', lastName: 'Perez', username: 'Ana_01', avatarId: 'avatar_book' } } } } } : {}),
    responses: { ...errors, [status]: {
      description: 'Perfil propio', content: { 'application/json': { schema: { $ref: '#/components/schemas/Profile' } } },
    } },
  };
}
export const usersPath: OpenAPIV3.PathItemObject = {
  post: operation('create', 'Crear perfil propio', '201', true),
  get: operation('read', 'Consultar perfil propio', '200'),
  patch: {
    ...operation('update', 'Actualizar perfil propio', '200', true),
    description: [
      'Usa un token Firebase por Bearer y actualiza exclusivamente el perfil del UID verificado con comprobación de revocación.',
      'Admite firstName, lastName, username y avatarId. Los campos editables omitidos conservan su valor.',
      'El servidor administra uid, email, authProvider, usernameNormalized, createdAt, updatedAt y profileCompleted. Se rechazan estos campos y cualquier campo desconocido si se envían en el cuerpo.',
      'Un cuerpo HTTP de cero bytes se rechaza con 400. Un objeto JSON explícito `{}` conserva los campos editables y puede sincronizar email, authProvider y updatedAt.',
      'La respuesta 200 contiene el perfil actualizado con fechas ISO. Si falla la lectura posterior a una escritura confirmada, la respuesta puede ser de error aunque los cambios ya estén guardados.',
      'Ante una respuesta ambigua, consultar GET /api/v1/users/me antes de repetir PATCH.',
    ].join('\n\n'),
  },
  delete: {
    operationId: 'deleteOwnProfile',
    tags: ['Perfiles'],
    summary: 'Eliminar la cuenta propia',
    security: [{ bearerAuth: [] }],
    description: [
      'Requiere un ID token Bearer de Firebase Authentication con comprobación de revocación. Elimina exclusivamente la cuenta del UID del token verificado. La autenticación debe tener un máximo de cinco minutos según auth_time.',
      'No admite cuerpo ni parámetros de consulta.',
      'Firestore elimina el perfil y libera la reserva del nombre de usuario en una transacción que conserva una marca persistente de eliminación. Después se elimina la identidad de Firebase Auth. La operación entre ambos servicios no es atómica.',
      'Se puede reintentar mientras la identidad siga autenticada y el token cumpla la política de autenticación reciente. El 204 confirma la limpieza y que la identidad fue eliminada o ya no existía. Un 401 después de una desconexión no confirma por sí solo la eliminación anterior.',
    ].join('\n\n'),
    responses: {
      '204': { description: 'Eliminación de la cuenta confirmada, sin cuerpo.' },
      '400': errorResponse('Solicitud no permitida, por ejemplo por incluir cuerpo o parámetros de consulta.'),
      '401': errorResponse('Autenticación ausente o inválida, incluido token expirado o revocado y cuenta deshabilitada o inexistente.'),
      '403': errorResponse('Se requiere autenticación reciente, o el proveedor o tenant no está permitido.'),
      '408': errorResponse('Se agotó el plazo de cinco segundos del controlador al leer una transferencia chunked que el parser JSON dejó sin leer.'),
      '409': errorResponse('Perfil o reserva de nombre de usuario inconsistente.'),
      '500': errors['500'],
      '503': errors['503'],
    },
  },
};
