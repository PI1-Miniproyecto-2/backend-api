import type { OpenAPIV3 } from 'openapi-types';

const errorResponse = (description: string, error: string): OpenAPIV3.ResponseObject => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { error },
    },
  },
});

export const openapi: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Salón de Estudio Colaborativo — Backend API',
    version: '0.1.0',
    description: 'API REST del Miniproyecto 2. Sprint 0. El endpoint del sistema está implmentado en TS-00-T06.',
  },
  servers: [{ url: '/', description: 'Servidor que publica esta especificación (local o Render)' }],
  tags: [
    { name: 'Salud', description: 'Comprobación básica del servidor HTTP.' },
    { name: 'Sistema', description: 'Diagnóstico versionado del servicio.' },
  ],
  paths: {
    '/health': {
      get: {
        operationId: 'getHealth',
        tags: ['Salud'],
        summary: 'Consultar la salud de la API',
        description: 'Comprobación HTTP independiente de Firestore y otros servicios externos.',
        responses: {
          '200': {
            description: 'La API responde correctamente.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Health' },
                example: { status: 'ok' },
              },
            },
          },
          '400': { $ref: '#/components/responses/InvalidJson' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/v1/system/status': {
      get: {
        operationId: 'getSystemStatus',
        tags: ['Sistema'],
        summary: 'Consultar el estado del servicio.',
        description: 'Contrato previsto: se integrará desde TS-00-T06. La ruta devuelve HTTP 200 con el estado del servicio al invocarla. La respuesta 200 describe el contrato tras su integración.',
        responses: {
          '200': {
            description: 'Estado actual del servicio.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SystemStatus' },
                example: { status: 'ok', service: 'backend-api' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
  components: {
    schemas: {
      Health: {
        type: 'object',
        required: ['status'],
        additionalProperties: false,
        properties: { status: { type: 'string', enum: ['ok'] } },
      },
      SystemStatus: {
        type: 'object',
        required: ['status', 'service'],
        additionalProperties: false,
        properties: {
          status: { type: 'string', enum: ['ok'] },
          service: { type: 'string', enum: ['backend-api'] },
        },
      },
      Error: {
        type: 'object',
        required: ['error'],
        additionalProperties: false,
        properties: { error: { type: 'string' } },
      },
    },
    responses: {
      InvalidJson: errorResponse('El middleware rechaza un cuerpo JSON mal formado, si se envía.', 'JSON inválido'),
      InternalError: errorResponse('Error inesperado procesado por el middleware global.', 'Error interno del servidor'),
      NotFound: errorResponse('Ruta no encontrada.', 'Ruta no encontrada'),
    },
  },
};
