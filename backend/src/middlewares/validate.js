import { AppError } from '../utils/AppError.js';
import { zodIssuesToDetails } from './errorHandler.js';

const PARTES = ['params', 'query', 'body'];

/**
 * Valida params, query y/o body con esquemas Zod.
 *
 *   router.post('/:id/pagos', validate({ params: idParams, body: pagoSchema }), controller)
 *
 * Los valores ya parseados (con coerciones y defaults aplicados) quedan en
 * `req.validated.{params,query,body}`. `req.body` también se reemplaza por la
 * versión parseada. Si algo es inválido responde 400 VALIDACION con el detalle
 * de todos los campos con error (de todas las partes a la vez).
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const validated = {};
    const details = [];

    for (const parte of PARTES) {
      const schema = schemas[parte];
      if (!schema) continue;

      const result = schema.safeParse(req[parte] ?? {});
      if (result.success) {
        validated[parte] = result.data;
      } else {
        details.push(...zodIssuesToDetails(result.error.issues, [parte]));
      }
    }

    if (details.length > 0) {
      return next(AppError.badRequest('VALIDACION', 'Los datos enviados no son válidos.', details));
    }

    req.validated = validated;
    if (validated.body !== undefined) req.body = validated.body;
    next();
  };
}
