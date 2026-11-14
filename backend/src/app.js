import express from 'express';
import apiRoutes from './routes.js';

/**
 * Crea la aplicación Express sin levantar el servidor,
 * para poder usarla tanto en server.js como en los tests (Supertest).
 */
export function createApp() {
  const app = express();

  app.use(express.json());
  app.use('/api', apiRoutes);

  return app;
}
