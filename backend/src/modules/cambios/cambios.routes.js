import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { cambioSinVentaBody } from './cambios.schemas.js';
import * as controller from './cambios.controller.js';

// Los cambios con venta registrada viven en /api/ventas/:id/cambios (ventas.routes.js).
const router = Router();

router.post(
  '/sin-venta',
  requireAuth,
  requirePermiso('cambios.registrar'),
  validate({ body: cambioSinVentaBody }),
  controller.cambiarSinVenta,
);

export default router;
