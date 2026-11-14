import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as s from './ventas.schemas.js';
import * as controller from './ventas.controller.js';

const router = Router();
router.use(requireAuth);

router.post(
  '/',
  requirePermiso('ventas.registrar'),
  validate({ body: s.crearBody }),
  controller.crear,
);

router.get(
  '/',
  requirePermiso('ventas.consultar'),
  validate({ query: s.listarQuery }),
  controller.listar,
);
export default router;
