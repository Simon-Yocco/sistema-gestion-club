import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

/** Convierte los issues de Zod en una lista simple de { campo, mensaje }. */
export function zodIssuesToDetails(issues, prefix = []) {
  return issues.map((issue) => ({
    campo: [...prefix, ...issue.path].join('.'),
    mensaje: issue.message,
  }));
}

/**
 * Middleware final de errores. Siempre responde
 * { error: { code, message, details } }.
 */
// Express reconoce el handler de errores porque tiene 4 parámetros (aunque no use _next).
export function errorHandler(err, req, res, _next) {
  let appError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = AppError.badRequest(
      'VALIDACION',
      'Los datos enviados no son válidos.',
      zodIssuesToDetails(err.issues),
    );
  } else if (err?.type === 'entity.parse.failed') {
    appError = AppError.badRequest('JSON_INVALIDO', 'El cuerpo de la solicitud no es JSON válido.');
  } else {
    if (!env.isTest) {
      console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    }
    appError = new AppError(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado.');
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details ?? null,
    },
  });
}
