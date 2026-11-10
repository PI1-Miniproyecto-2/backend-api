import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../services/api-error';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }
  console.error('Error interno del servidor');
  res.status(500).json({ error: 'Error interno del servidor' });
};
