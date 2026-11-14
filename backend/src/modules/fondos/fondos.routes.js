// Rutas de fondos (Fase 10): egresos, préstamos, depósitos/extracciones, saldos y movimientos.
import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as s from './fondos.schemas.js';
import * as egresos from './egresos.service.js';

const responder =
  (fn, status = 200) =>
  async (req, res) => {
    res.status(status).json(await fn(req));
  };

// ---------------------------------------------------------------- /api/egresos

export const egresosRoutes = Router();
egresosRoutes.use(requireAuth);
egresosRoutes.post(
  '/',
  requirePermiso('egresos.registrar'),
  validate({ body: s.egresoBody }),
  responder((req) => egresos.crear(req.body, req.user), 201),
);
egresosRoutes.get(
  '/',
  requirePermiso('egresos.consultar'),
  validate({ query: s.listarEgresosQuery }),
  responder((req) => egresos.listar(req.validated.query)),
);
