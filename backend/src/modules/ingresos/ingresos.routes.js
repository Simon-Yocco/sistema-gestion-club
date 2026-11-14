import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as s from './ingresos.schemas.js';
import * as controller from './ingresos.controller.js';

const router = Router();
router.use(requireAuth);

router.post(
  '/',
  requirePermiso('mercaderia.ingresar'),
  validate({ body: s.crearBody }),
  controller.crear,
);

router.get(
  '/',
  requirePermiso('mercaderia.consultar'),
  validate({ query: s.listarQuery }),
  controller.listar,
);
router.get(
  '/:id',
  requirePermiso('mercaderia.consultar'),
  validate({ params: idParams }),
  controller.obtener,
);
export default router;
