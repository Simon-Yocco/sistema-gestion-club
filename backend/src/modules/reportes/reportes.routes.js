import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { rangoFechasQuery, rangoValido } from '../../utils/schemas.js';
import { aCSV } from '../../utils/csv.js';
import * as reportes from './reportes.service.js';

const reporteQuery = z
  .object({
    ...rangoFechasQuery,
    /** 11.8 ?formato=csv descarga la tabla de detalle del reporte. */
    formato: z.enum(['json', 'csv']).default('json'),
  })
  .refine(...rangoValido);

/** Responde el reporte en JSON o, con ?formato=csv, como archivo CSV. */
const responder = (nombre, fn) => async (req, res) => {
  const { formato, ...filtros } = req.validated.query;
  const { csv, ...datos } = await fn(filtros);

  if (formato === 'csv') {
    const archivo = `${nombre}_${filtros.desde ?? 'inicio'}_${filtros.hasta ?? 'hoy'}.csv`;
    res.type('text/csv; charset=utf-8').attachment(archivo).send(aCSV(csv.columnas, csv.filas));
    return;
  }
  res.json(datos);
};

const router = Router();
router.use(requireAuth, requirePermiso('reportes.ver'));

const REPORTES = {
  ventas: reportes.ventas,
  'ventas-por-medio': reportes.ventasPorMedio,
  ganancia: reportes.ganancia,
  'stock-valorizado': reportes.stockValorizado,
  devoluciones: reportes.devoluciones,
  egresos: reportes.egresos,
  comision: reportes.comision,
  depositos: reportes.depositos,
};

for (const [ruta, fn] of Object.entries(REPORTES)) {
  router.get(`/${ruta}`, validate({ query: reporteQuery }), responder(ruta, fn));
}

export default router;
