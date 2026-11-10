import { Router } from 'express';
import { createUsersRoutes } from './users.routes';
import { health } from '../controllers/health.controller';
import { systemRoutes } from './system.routes';

export const routes = Router();
routes.get('/health', health);
routes.use('/api/v1/system', systemRoutes);

routes.use('/api/v1/users', createUsersRoutes());
