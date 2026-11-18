
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError } from '../services/api-error';

// Manejar rutas que no existen
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada'
  });
};


export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  next
) => {
  // Verificar si ya se enviaron los encabezados
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: error.message
    });
    return;
  }

  if (
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400
  ) {
    res.status(400).json({
      error: 'JSON inválido'
    });
    return;
  }

  console.error('========== ERROR INTERNO ==========');
  console.error('Fecha:', new Date().toISOString());
  console.error('Método HTTP:', req.method);
  console.error('Ruta:', req.path);

  if (error instanceof Error) {
    console.error('Tipo de error:', error.name);
    console.error('Mensaje:', error.message);
    console.error('Stack trace:', error.stack);
  } else {
    console.error('Error desconocido:', error);
  }

  console.error('===================================');

  // Responder sin exponer información sensible
  res.status(500).json({
    error: 'Error interno del servidor'
  });
};
