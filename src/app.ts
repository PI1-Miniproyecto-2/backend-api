import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { routes } from './routes';
import { docsRoutes } from './routes/docs.routes';
import { errorHandler, notFound } from './middlewares/error.middleware';

export const app = express();
export const parseJson = express.json({
  verify(_req, res, body) {
    if (body.length === 0) (res as express.Response).locals.emptyJsonBody = true;
  },
});
app.disable('x-powered-by');
app.use(cors({ origin: env.corsOrigins }));
app.use(parseJson);
app.use(routes);
app.use(docsRoutes);
app.use(notFound);
app.use(errorHandler);
