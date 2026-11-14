import express from 'express';

/**
 * Crea la aplicación Express sin levantar el servidor,
 * para poder usarla tanto en server.js como en los tests (Supertest).
 */
export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
