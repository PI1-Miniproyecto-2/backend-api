import type { RequestHandler } from 'express';
import { identityOf } from '../middlewares/auth.middleware';
import type { RoomMembersService } from '../services/room-members.service';

export function roomMembersController(
  service: RoomMembersService
) {
  const list: RequestHandler<{ roomId: string }> =
    async (req, res) => {
      const result = await service.list(
        identityOf(req).uid,
        req.params.roomId
      );

      res.set('Cache-Control', 'no-store');
      res.status(200).json(result);
    };

  return { list };
}