import * as authService from './auth.service.js';
import { setCookieSesion, borrarCookieSesion } from './token.js';
import { accionesDe } from '../../config/permisos.js';

// La respuesta incluye las acciones permitidas, para que el frontend arme el menú
// sin duplicar la matriz de permisos (la validación real sigue estando en la API).

export async function login(req, res) {
  const { usuario, token } = await authService.login(req.body);
  setCookieSesion(res, token);
  res.json({ usuario, permisos: accionesDe(usuario.rol) });
}

export function logout(_req, res) {
  borrarCookieSesion(res);
  res.status(204).end();
}

export function me(req, res) {
  res.json({ usuario: req.user, permisos: accionesDe(req.user.rol) });
}
