import type { Request, RequestHandler } from 'express';
import { createAuthService, type VerifiedIdentity } from '../services/auth.service';
import { ApiError } from '../services/api-error';

export function identityOf(req: Request): VerifiedIdentity {
  if (!req.identity) throw new ApiError(401, 'Autenticación requerida');
  return req.identity;
}

export function authenticate(verify = createAuthService()): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.get('Authorization');
      const match = header && /^Bearer ([^\s,]+)$/i.exec(header);
      if (!match) throw new ApiError(401, 'Se requiere Authorization: Bearer <token>');
      req.identity = await verify(match[1]);
      next();
    } catch (error) { next(error); }
  };
}
