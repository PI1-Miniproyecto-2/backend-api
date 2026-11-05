import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { routes } from './routes';
import { docsRoutes } from './routes/docs.routes';
import { errorHandler, notFound } from './middlewares/error.middleware';

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json());
app.use(routes);
app.use(docsRoutes);
app.use(notFound);
app.use(errorHandler);
