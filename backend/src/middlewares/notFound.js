import { AppError } from '../utils/AppError.js';

/** Rutas inexistentes: responde 404 con el formato estándar de error. */
export function notFound(req, _res, next) {
  next(
    AppError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 'RUTA_NO_ENCONTRADA'),
  );
}
