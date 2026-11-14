import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import apiRoutes from './routes.js';
import { env } from './config/env.js';
import { notFound } from './middlewares/notFound.js';
import { errorHandler } from './middlewares/errorHandler.js';

/**
 * Crea la aplicación Express sin levantar el servidor,
 * para poder usarla tanto en server.js como en los tests (Supertest).
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // credentials: true → el frontend (otro puerto en desarrollo) puede mandar la cookie de sesión.
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
