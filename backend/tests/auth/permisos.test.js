import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PERMISOS, puede, accionesDe } from '../../src/config/permisos.js';
import { requireAuth, requirePermiso } from '../../src/middlewares/auth.js';
import { errorHandler } from '../../src/middlewares/errorHandler.js';
import { createApp } from '../../src/app.js';
import { loginComo } from '../helpers/auth.js';

const SOLO_ADMIN = [
  'mercaderia.ingresar',
  'mercaderia.consultar',
  'productos.gestionar',
  'reportes.ver',
  'saldos.consultar',
  'movimientos.consultar',
  'usuarios.gestionar',
];

describe('matriz de permisos', () => {
  it('el admin puede todo', () => {
    for (const accion of Object.keys(PERMISOS)) expect(puede('admin', accion)).toBe(true);
  });

  it('secretaría puede las operaciones de la regla 2.1', () => {
    for (const accion of [
      'ventas.registrar',
      'ventas.cobrar',
      'cambios.registrar',
      'devoluciones.registrar',
      'egresos.registrar',
      'prestamos.registrar',
      'transferencias_medios.registrar',
      'stock.consultar',
      'deudores.consultar',
    ]) {
      expect(puede('secretaria', accion), accion).toBe(true);
    }
  });

  it('secretaría no puede las operaciones exclusivas del admin (regla 2.2)', () => {
    for (const accion of SOLO_ADMIN) expect(puede('secretaria', accion), accion).toBe(false);
  });

  it('una acción inexistente lanza error (evita typos)', () => {
    expect(() => puede('admin', 'ventas.registar')).toThrow(/desconocida/);
    expect(() => requirePermiso('ventas.registar')).toThrow(/desconocida/);
  });

  it('accionesDe lista las acciones del rol', () => {
    expect(accionesDe('admin')).toHaveLength(Object.keys(PERMISOS).length);
    expect(accionesDe('secretaria')).not.toContain('usuarios.gestionar');
  });
});

describe('requirePermiso', () => {
  function app() {
    const rutas = express.Router();
    rutas.use(cookieParser());
    rutas.get('/precios', requireAuth, requirePermiso('productos.gestionar'), (_q, r) =>
      r.json({}),
    );
    rutas.get('/venta', requireAuth, requirePermiso('ventas.registrar'), (_q, r) => r.json({}));
    rutas.use(errorHandler);
    const contenedor = express();
    contenedor.use('/prueba', rutas);
    contenedor.use(createApp());
    return contenedor;
  }

  it('secretaría: 403 en acción de admin, 200 en acción propia', async () => {
    const { agent } = await loginComo({ rol: 'secretaria' }, app());
    expect((await agent.get('/prueba/precios')).status).toBe(403);
    expect((await agent.get('/prueba/venta')).status).toBe(200);
  });

  it('admin: 200 en ambas', async () => {
    const { agent } = await loginComo({ rol: 'admin' }, app());
    expect((await agent.get('/prueba/precios')).status).toBe(200);
    expect((await agent.get('/prueba/venta')).status).toBe(200);
  });

  it('/me devuelve los permisos del usuario', async () => {
    const { agent } = await loginComo({ rol: 'secretaria' });
    const res = await agent.get('/api/auth/me');
    expect(res.body.permisos).toContain('ventas.registrar');
    expect(res.body.permisos).not.toContain('reportes.ver');
  });
});
