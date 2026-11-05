import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapi } from '../config/openapi';

export const docsRoutes = Router();

docsRoutes.get('/openapi.json', (_req, res) => {
  res.json(openapi);
});

docsRoutes.use('/api-docs', swaggerUi.serve, swaggerUi.setup(undefined, {
  swaggerOptions: {
    url: '/openapi.json',
    validatorUrl: null,
  },
}));
