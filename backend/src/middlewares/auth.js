import { Usuario } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { COOKIE_SESION, verificarToken, borrarCookieSesion } from '../modules/auth/token.js';
import { usuarioPublico } from '../modules/auth/auth.service.js';
import { existeAccion, puede } from '../config/permisos.js';

/**
 * 3.4 Exige sesión válida. Lee la cookie, valida el JWT y carga el usuario desde la base
 * en `req.user` (así un usuario desactivado o con rol cambiado pierde el acceso al instante,
 * sin esperar a que venza el token).
 */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_SESION];
  if (!token) throw AppError.unauthorized();

  const payload = verificarToken(token);
  const usuario = payload ? await Usuario.findByPk(Number(payload.sub)) : null;

  if (!usuario || !usuario.activo) {
    borrarCookieSesion(res);
    throw AppError.unauthorized(
      'La sesión venció o no es válida. Volvé a iniciar sesión.',
      'SESION_INVALIDA',
    );
  }

  req.user = usuarioPublico(usuario);
  next();
}

/**
 * 3.5 Exige que el usuario tenga alguno de los roles indicados. Va después de requireAuth.
 * Preferir requirePermiso (src/config/permisos.js) en los endpoints de negocio.
 *
 *   router.get('/', requireAuth, requireRole('admin'), controller.listar)
 */
/**
 * 3.6 Exige permiso para una acción de la matriz (src/config/permisos.js). Va después de
 * requireAuth. Una acción inexistente falla al arrancar, no en el request.
 *
 *   router.post('/', requireAuth, requirePermiso('ventas.registrar'), controller.crear)
 */
export function requirePermiso(accion) {
  if (!existeAccion(accion)) throw new Error(`requirePermiso: acción desconocida "${accion}"`);
  const middleware = (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!puede(req.user.rol, accion)) throw AppError.forbidden();
    next();
  };
  // Marca la acción en el middleware: la revisión automática de permisos (15.2) la lee.
  middleware.accion = accion;
  return middleware;
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.rol)) throw AppError.forbidden();
    next();
  };
}
