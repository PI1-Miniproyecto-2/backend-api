import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { createAuthService } from '../services/auth.service';
import { createProfileService } from '../services/profile.service';
import { usersController } from '../controllers/users.controller';

export function createUsersRoutes(service = createProfileService(), verify = createAuthService()) {
  const router = Router();
  const controller = usersController(service);
  router.route('/me').all(authenticate(verify))
    .post(controller.create).get(controller.read).patch(controller.update).delete(controller.remove);
  return router;
}
