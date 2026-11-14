// Rutas de fondos (Fase 10): egresos, préstamos, depósitos/extracciones, saldos y movimientos.
import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as s from './fondos.schemas.js';
import * as egresos from './egresos.service.js';
import * as prestamos from './prestamos.service.js';
import * as transferencias from './transferencias.service.js';
import * as saldos from './saldos.service.js';
import * as libro from './movimientos.consulta.js';

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

// ---------------------------------------------------------------- /api/prestamos

export const prestamosRoutes = Router();
prestamosRoutes.use(requireAuth, requirePermiso('prestamos.registrar'));
prestamosRoutes.post(
  '/',
  validate({ body: s.prestamoBody }),
  responder((req) => prestamos.registrar(req.body, req.user), 201),
);
prestamosRoutes.get(
  '/',
  validate({ query: s.listarPrestamosQuery }),
  responder((req) => prestamos.listar(req.validated.query)),
);

// ---------------------------------------------------------------- /api/transferencias-medios

export const transferenciasRoutes = Router();
transferenciasRoutes.use(requireAuth);
transferenciasRoutes.post(
  '/',
  requirePermiso('transferencias_medios.registrar'),
  validate({ body: s.transferenciaMediosBody }),
  responder((req) => transferencias.crear(req.body, req.user), 201),
);
transferenciasRoutes.get(
  '/',
  requirePermiso('transferencias_medios.consultar'),
  validate({ query: s.listarTransferenciasQuery }),
  responder((req) => transferencias.listar(req.validated.query)),
);

// ---------------------------------------------------------------- /api/saldos y /api/movimientos

/** 10.4 Saldo en efectivo, en transferencia, total y deuda con la comisión. */
export const saldosRoutes = Router();
saldosRoutes.get(
  '/',
  requireAuth,
  requirePermiso('saldos.consultar'),
  responder(() => saldos.resumen()),
);

/** 10.5 Libro de movimientos (solo admin). */
export const movimientosRoutes = Router();
movimientosRoutes.get(
  '/',
  requireAuth,
  requirePermiso('movimientos.consultar'),
  validate({ query: s.listarMovimientosQuery }),
  responder((req) => libro.listar(req.validated.query)),
);
