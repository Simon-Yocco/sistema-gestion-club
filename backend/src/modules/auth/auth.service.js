import { Usuario } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { verifyPassword, verifyPasswordDeRelleno } from './password.js';
import { firmarToken } from './token.js';

/** Datos del usuario que se pueden mandar al frontend (nunca el hash). */
export function usuarioPublico(usuario) {
  const { id, nombre, username, rol, activo } = usuario;
  return { id, nombre, username, rol, activo };
}

/**
 * Valida usuario y contraseña. Devuelve { usuario, token }.
 * - Usuario inexistente o contraseña incorrecta → 401 CREDENCIALES_INVALIDAS (mismo mensaje,
 *   para no revelar qué usuarios existen).
 * - Usuario desactivado (con contraseña correcta) → 403 USUARIO_INACTIVO.
 */
export async function login({ username, password }) {
  const usuario = await Usuario.scope('conPassword').findOne({ where: { username } });

  const passwordOk = usuario
    ? await verifyPassword(password, usuario.password_hash)
    : await verifyPasswordDeRelleno(password);

  if (!usuario || !passwordOk) {
    throw AppError.unauthorized('Usuario o contraseña incorrectos.', 'CREDENCIALES_INVALIDAS');
  }
  if (!usuario.activo) {
    throw AppError.forbidden(
      'El usuario está desactivado. Hablá con el administrador.',
      'USUARIO_INACTIVO',
    );
  }

  return { usuario: usuarioPublico(usuario), token: firmarToken(usuario) };
}
