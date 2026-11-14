import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { rangoFechasQuery, rangoValido } from '../../utils/schemas.js';
import * as reportes from './reportes.service.js';

const periodoQuery = z.object({ ...rangoFechasQuery }).refine(...rangoValido);

/** Responde el reporte en JSON (sin la tabla interna para CSV). */
const responder = (fn) => async (req, res) => {
  const { csv: _csv, ...datos } = await fn(req.validated.query);
  res.json(datos);
};

const router = Router();
router.use(requireAuth, requirePermiso('reportes.ver'));

const REPORTES = {
  ventas: reportes.ventas,
  'ventas-por-medio': reportes.ventasPorMedio,
  ganancia: reportes.ganancia,
};

for (const [ruta, fn] of Object.entries(REPORTES)) {
  router.get(`/${ruta}`, validate({ query: periodoQuery }), responder(fn));
}

export default router;
