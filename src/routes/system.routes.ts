import { Router } from 'express';
import { systemStatus } from '../controllers/system.controller';

export const systemRoutes = Router();
systemRoutes.get('/status', systemStatus);
