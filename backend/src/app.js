import express from 'express';
import apiRoutes from './routes.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

/**
 * Crea la aplicación Express sin levantar el servidor,
 * para poder usarla tanto en server.js como en los tests (Supertest).
 */
export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
