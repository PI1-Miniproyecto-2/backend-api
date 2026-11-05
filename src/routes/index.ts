import { Router } from 'express';
import { health } from '../controllers/health.controller';

export const routes = Router();
routes.get('/health', health);
