import * as authService from './auth.service.js';
import { setCookieSesion } from './token.js';

export async function login(req, res) {
  const { usuario, token } = await authService.login(req.body);
  setCookieSesion(res, token);
  res.json({ usuario });
}
