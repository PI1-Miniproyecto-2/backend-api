import type { RequestHandler } from 'express';
import { identityOf } from '../middlewares/auth.middleware';
import type { RoomService } from '../services/room.service';

export function roomsController(service: RoomService) {
  const create: RequestHandler = async (req, res) => {
    res.status(201).json(await service.create(identityOf(req).uid, req.body));
  };
  const list: RequestHandler = async (req, res) => {
    res.json(await service.list(identityOf(req).uid));
  };
  const read: RequestHandler<{ roomId: string }> = async (req, res) => {
    res.json(await service.read(identityOf(req).uid, req.params.roomId));
  };
  return { create, list, read };
}
