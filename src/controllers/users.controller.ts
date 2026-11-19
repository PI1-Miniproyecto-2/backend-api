import type { RequestHandler } from 'express';
import { identityOf } from '../middlewares/auth.middleware';
import { ApiError } from '../services/api-error';
import type { ProfileService } from '../services/profile.service';

export function usersController(service: ProfileService): Record<'create' | 'read' | 'update' | 'remove', RequestHandler> {
  return {
    create: async (req, res) => { res.status(201).json(await service.create(identityOf(req), req.body)); },
    read: async (req, res) => { res.json(await service.read(identityOf(req))); },
    update: async (req, res) => {
      const body = res.locals.emptyJsonBody ? undefined : req.body;
      res.json(await service.update(identityOf(req), body));
    },
    remove: async (req, res) => {
      const identity = identityOf(req);
      const invalidInput = () => new ApiError(400, 'La eliminación de cuenta no admite cuerpo ni parámetros de consulta');
      const encoding = req.get('Content-Encoding')?.toLowerCase();
      const hasParsedBody = req.body !== undefined &&
        (!res.locals.emptyJsonBody || Boolean(encoding && encoding !== 'identity'));
      if (Object.keys(req.query).length || Number(req.get('Content-Length')) > 0 ||
          hasParsedBody) {
        throw invalidInput();
      }
      // Solo queda por comprobar un cuerpo chunked que el parser no haya leído.
      if (req.get('Transfer-Encoding') && !req.readableEnded) {
        await new Promise<void>((resolve, reject) => {
          function finish(error?: ApiError) {
            clearTimeout(timer);
            req.off('readable', onReadable);
            req.off('end', finish);
            req.off('error', onInterrupted);
            req.off('close', onInterrupted);
            if (error) reject(error);
            else resolve();
          }
          function onReadable() {
            if (req.read() !== null) finish(invalidInput());
          }
          function onInterrupted() {
            finish(new ApiError(400, 'Solicitud interrumpida'));
          }
          const timer = setTimeout(() => {
            res.set('Connection', 'close');
            finish(new ApiError(408, 'Tiempo de espera agotado al recibir la solicitud'));
          }, 5_000);
          req.once('end', finish);
          req.once('error', onInterrupted);
          req.once('close', onInterrupted);
          req.on('readable', onReadable);
          if (req.destroyed) onInterrupted();
        });
      }
      await service.remove(identity);
      res.status(204).end();
    },
  };
}
