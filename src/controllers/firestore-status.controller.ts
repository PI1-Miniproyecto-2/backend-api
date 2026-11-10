import type { RequestHandler } from 'express';
import { checkFirestoreConnection } from '../services/firestore.service';

export const firestoreStatus: RequestHandler = async (req, res, next) => {
  const expectedKey = process.env.DIAGNOSTIC_API_KEY;

  if (!expectedKey || req.get('x-diagnostic-key') !== expectedKey) {
    res.status(403).json({ error: 'Acceso denegado' });
    return;
  }

  try {
    await checkFirestoreConnection();

    res.status(200).json({
      status: 'ok',
      database: 'firestore'
    });
  } catch (error) {
    next(error);
  }
};
