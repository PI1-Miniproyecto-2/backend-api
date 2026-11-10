import type { RequestHandler } from 'express';
import { identityOf } from '../middlewares/auth.middleware';
import type { ProfileService } from '../services/profile.service';

export function usersController(service: ProfileService): Record<'create' | 'read' | 'update' | 'remove', RequestHandler> {
  return {
    create: async (req, res) => { res.status(201).json(await service.create(identityOf(req), req.body)); },
    read: async (req, res) => { res.json(await service.read(identityOf(req))); },
    update: async (req, res) => { res.json(await service.update(identityOf(req), req.body)); },
    remove: async (req, res) => { await service.remove(identityOf(req)); res.status(204).end(); },
  };
}
