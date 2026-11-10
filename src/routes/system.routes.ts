import { Router } from 'express';
import { systemStatus } from '../controllers/system.controller';
import { firestoreStatus } from '../controllers/firestore-status.controller';

export const systemRoutes = Router();

systemRoutes.get('/status', systemStatus);
systemRoutes.get('/firestore-status', firestoreStatus);
