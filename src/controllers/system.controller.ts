import type { RequestHandler } from 'express';
import { getSystemStatus } from '../services/system.service';

export const systemStatus: RequestHandler = (_req, res) => {
  res.status(200).json(getSystemStatus());
};
