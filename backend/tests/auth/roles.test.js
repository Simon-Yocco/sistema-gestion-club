import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { requireAuth, requireRole } from '../../src/middlewares/auth.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { createApp } from '../../src/app.js';
import { loginComo } from '../helpers/auth.js';

/** Rutas de prueba protegidas por rol en /prueba, y la app real (para el login) en el resto. */
function appConRutasProtegidas() {
  const protegidas = express.Router();
  protegidas.use(cookieParser());
  protegidas.get('/solo-admin', requireAuth, requireRole('admin'), (_req, res) =>
    res.json({ ok: 1 }),
  );
  protegidas.get('/ambos', requireAuth, requireRole('admin', 'secretaria'), (_req, res) =>
    res.json({ ok: 1 }),
  );
  protegidas.use(errorHandler);

  const contenedor = express();
  contenedor.use('/prueba', protegidas);
  contenedor.use(createApp());
  return contenedor;
}

describe('requireRole', () => {
  it('sin sesión → 401', async () => {
    const res = await request(appConRutasProtegidas()).get('/prueba/solo-admin');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_AUTENTICADO');
  });

  it('secretaría en ruta de admin → 403 SIN_PERMISO', async () => {
    const { agent } = await loginComo({ rol: 'secretaria' }, appConRutasProtegidas());
    const res = await agent.get('/prueba/solo-admin');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SIN_PERMISO');
  });

  it('admin en ruta de admin → 200', async () => {
    const { agent } = await loginComo({ rol: 'admin' }, appConRutasProtegidas());
    expect((await agent.get('/prueba/solo-admin')).status).toBe(200);
  });

  it('ruta para varios roles acepta a cualquiera de ellos', async () => {
    const { agent } = await loginComo({ rol: 'secretaria' }, appConRutasProtegidas());
    expect((await agent.get('/prueba/ambos')).status).toBe(200);
  });

  it('usado sin requireAuth antes → 401', async () => {
    const app = express();
    app.get('/x', requireRole('admin'), (_req, res) => res.json({}));
    app.use(errorHandler);
    expect((await request(app).get('/x')).status).toBe(401);
  });
});
