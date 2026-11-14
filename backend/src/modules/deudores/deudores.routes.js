import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as service from './deudores.service.js';

const listarQuery = z.object({
  /** antiguedad: la deuda más vieja primero (default) · monto: el que más debe primero */
  orden: z.enum(['antiguedad', 'monto']).default('antiguedad'),
});

const router = Router();

router.get(
  '/',
  requireAuth,
  requirePermiso('deudores.consultar'),
  validate({ query: listarQuery }),
  async (req, res) => {
    res.json(await service.listar(req.validated.query));
  },
);

export default router;
