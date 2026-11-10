import type { RequestHandler } from 'express';
import { identityOf } from './auth.middleware';
import { ApiError } from '../services/api-error';
import { createProfileService } from '../services/profile.service';

// Usar después de authenticate() en futuras funciones privadas del salón.
export function requireCompleteProfile(service = createProfileService()): RequestHandler {
  return async (req, _res, next) => {
    try {
      const profile = await service.read(identityOf(req));
      if (!profile.profileCompleted) throw new ApiError(403, 'Debe completar su perfil');
      next();
    } catch (error) {
      next(error instanceof ApiError && error.status === 404 ? new ApiError(403, 'Debe completar su perfil') : error);
    }
  };
}
