// Sesión: JWT firmado con JWT_SECRET, guardado en una cookie httpOnly
// (JavaScript del navegador no puede leerla, lo que protege contra robo por XSS).
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export const COOKIE_SESION = 'tienda_sesion';

const UNIDADES_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** "8h" → 28800000. Acepta s, m, h, d. */
export function duracionEnMs(texto) {
  const match = /^(\d+)\s*([smhd])$/.exec(String(texto).trim());
  if (!match) throw new Error(`JWT_EXPIRES_IN inválido: "${texto}" (usar por ej. 8h, 30m, 1d)`);
  return Number(match[1]) * UNIDADES_MS[match[2]];
}

const DURACION_MS = duracionEnMs(env.JWT_EXPIRES_IN);

export function firmarToken(usuario) {
  return jwt.sign({ sub: String(usuario.id), rol: usuario.rol }, env.JWT_SECRET, {
    expiresIn: Math.floor(DURACION_MS / 1000),
    algorithm: 'HS256',
  });
}

/** Devuelve el payload o null si el token es inválido o expiró. */
export function verificarToken(token) {
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

export const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction, // en producción solo por HTTPS
  path: '/',
  maxAge: DURACION_MS,
});

export function setCookieSesion(res, token) {
  res.cookie(COOKIE_SESION, token, opcionesCookie());
}

export function borrarCookieSesion(res) {
  const { maxAge: _maxAge, ...opciones } = opcionesCookie();
  res.clearCookie(COOKIE_SESION, opciones);
}
