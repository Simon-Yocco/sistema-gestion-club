import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { COOKIE_SESION, verificarToken } from '../../src/modules/auth/token.js';
import { crearUsuario, PASSWORD_TEST } from '../helpers/factories.js';

const app = createApp();
const login = (body) => request(app).post('/api/auth/login').send(body);

function cookieDeSesion(res) {
  return (res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${COOKIE_SESION}=`));
}

describe('POST /api/auth/login', () => {
  it('login correcto: devuelve el usuario y setea la cookie httpOnly con el JWT', async () => {
    const u = await crearUsuario({ username: 'maria', nombre: 'María', rol: 'secretaria' });

    const res = await login({ username: 'maria', password: PASSWORD_TEST });

    expect(res.status).toBe(200);
    expect(res.body.usuario).toEqual({
      id: u.id,
      nombre: 'María',
      username: 'maria',
      rol: 'secretaria',
      activo: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('password');

    const cookie = cookieDeSesion(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const token = cookie.split(';')[0].split('=')[1];
    expect(verificarToken(token)).toMatchObject({ sub: String(u.id), rol: 'secretaria' });
  });

  it('el usuario no distingue mayúsculas ni espacios', async () => {
    await crearUsuario({ username: 'maria' });
    const res = await login({ username: '  MARIA ', password: PASSWORD_TEST });
    expect(res.status).toBe(200);
  });

  it('contraseña incorrecta → 401 sin cookie', async () => {
    await crearUsuario({ username: 'maria' });
    const res = await login({ username: 'maria', password: 'otra-clave' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('CREDENCIALES_INVALIDAS');
    expect(cookieDeSesion(res)).toBeUndefined();
  });

  it('usuario inexistente → mismo 401 que contraseña incorrecta', async () => {
    const res = await login({ username: 'nadie', password: PASSWORD_TEST });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({
      code: 'CREDENCIALES_INVALIDAS',
      message: 'Usuario o contraseña incorrectos.',
    });
  });

  it('usuario inactivo no puede entrar → 403', async () => {
    await crearUsuario({ username: 'maria', activo: false });
    const res = await login({ username: 'maria', password: PASSWORD_TEST });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USUARIO_INACTIVO');
    expect(cookieDeSesion(res)).toBeUndefined();
  });

  it('usuario inactivo con contraseña incorrecta → 401 (no revela que existe)', async () => {
    await crearUsuario({ username: 'maria', activo: false });
    const res = await login({ username: 'maria', password: 'otra-clave' });
    expect(res.status).toBe(401);
  });

  it('faltan datos → 400 VALIDACION', async () => {
    const res = await login({ username: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.campo)).toEqual(['body.username', 'body.password']);
  });
});
