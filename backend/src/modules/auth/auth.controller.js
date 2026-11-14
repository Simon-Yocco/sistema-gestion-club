import * as authService from './auth.service.js';
import { setCookieSesion, borrarCookieSesion } from './token.js';

export async function login(req, res) {
  const { usuario, token } = await authService.login(req.body);
  setCookieSesion(res, token);
  res.json({ usuario });
}

export function logout(_req, res) {
  borrarCookieSesion(res);
  res.status(204).end();
}

export function me(req, res) {
  res.json({ usuario: req.user });
}
