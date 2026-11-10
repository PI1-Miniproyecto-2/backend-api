export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function infrastructureError(error: unknown): never {
  if (error instanceof ApiError) throw error;
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if ([4, 8, 10, 14, 'deadline-exceeded', 'resource-exhausted', 'aborted', 'unavailable'].includes(code as string | number)) {
    throw new ApiError(503, 'Servicio temporalmente no disponible');
  }
  throw new ApiError(500, 'Error interno del servidor');
}
