import { Router, type ErrorRequestHandler } from 'express';
import { roomsController } from '../controllers/rooms.controller';
import { roomMembersController } from '../controllers/room-members.controller';
import { authenticate, identityOf } from '../middlewares/auth.middleware';
import { requireCompleteProfile } from '../middlewares/profile.middleware';
import { ApiError } from '../services/api-error';
import { createAuthService } from '../services/auth.service';
import { createProfileService } from '../services/profile.service';
import { createRoomService } from '../services/room.service';
import { createRoomMembersService } from '../services/room-members.service';

const handleInvalidRoomId: ErrorRequestHandler =
  (error: unknown, _req, _res, next) => {
    if (
      error instanceof URIError &&
      'status' in error &&
      error.status === 400
    ) {
      next(
        new ApiError(
          400,
          'Identificador de sala inválido'
        )
      );
      return;
    }

    next(error);
  };

export function createRoomsRoutes(
  service = createRoomService(),
  verify = createAuthService(),
  profiles = createProfileService(),
  membersService = createRoomMembersService(),
) {
  const router = Router();
  const controller = roomsController(service);
  const membersController =
    roomMembersController(membersService);

  const completeProfile = requireCompleteProfile(profiles);

  router.use(
    authenticate(verify),
    (req, _res, next) => {
      if (identityOf(req).tenant !== undefined) {
        throw new ApiError(
          403,
          'No se admite el acceso a salas desde otro tenant'
        );
      }

      next();
    },
    completeProfile
  );

  router.route('/')
    .post(controller.create)
    .get(controller.list);

  // US-08: Consultar miembros y autores del historial.
  router.get(
    '/:roomId/members',
    membersController.list
  );

  router.get('/:roomId', controller.read);

  // US-07: Ingresar a una sala.
  router.post('/:roomId/join', controller.join);

  // US-10: Editar una sala.
  router.patch('/:roomId', controller.update);

  // US-11: Eliminar una sala.
  router.delete('/:roomId', controller.remove);

  router.use(handleInvalidRoomId);

  return router;
}