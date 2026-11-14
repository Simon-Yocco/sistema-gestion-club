import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../src/app.js';
import { Usuario } from '../../src/models/index.js';
import { COOKIE_SESION, firmarToken } from '../../src/modules/auth/token.js';
import { env } from '../../src/config/env.js';
import { loginComo } from '../helpers/auth.js';

const app = createApp();
const conCookie = (token) => `${COOKIE_SESION}=${token}`;

describe('GET /api/auth/me y requireAuth', () => {
  it('con sesión devuelve el usuario actual', async () => {
    const { agent, usuario } = await loginComo({ nombre: 'Laura', rol: 'admin' });
    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ id: usuario.id, nombre: 'Laura', rol: 'admin' });
  });

  it('sin cookie → 401 NO_AUTENTICADO', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_AUTENTICADO');
  });

  it('token adulterado → 401 SESION_INVALIDA', async () => {
    const falso = jwt.sign({ sub: '1', rol: 'admin' }, 'otro-secreto-de-al-menos-32-caracteres!!');
    const res = await request(app).get('/api/auth/me').set('Cookie', conCookie(falso));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESION_INVALIDA');
  });

  it('token vencido → 401 SESION_INVALIDA', async () => {
    const { usuario } = await loginComo();
    const vencido = jwt.sign(
      { sub: String(usuario.id), rol: usuario.rol, exp: Math.floor(Date.now() / 1000) - 60 },
      env.JWT_SECRET,
    );
    const res = await request(app).get('/api/auth/me').set('Cookie', conCookie(vencido));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESION_INVALIDA');
  });

  it('si desactivan al usuario, pierde el acceso aunque tenga un token válido', async () => {
    const { agent, usuario } = await loginComo();
    await Usuario.update({ activo: false }, { where: { id: usuario.id } });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESION_INVALIDA');
  });

  it('el rol se lee de la base, no del token', async () => {
    const { usuario } = await loginComo({ rol: 'secretaria' });
    const tokenConRolViejo = firmarToken({ id: usuario.id, rol: 'admin' });
    const res = await request(app).get('/api/auth/me').set('Cookie', conCookie(tokenConRolViejo));
    expect(res.body.usuario.rol).toBe('secretaria');
  });
});

describe('POST /api/auth/logout', () => {
  it('borra la cookie y la sesión deja de valer', async () => {
    const { agent } = await loginComo();

    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(new RegExp(`^${COOKIE_SESION}=;`));

    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('funciona aunque no haya sesión', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });
});
