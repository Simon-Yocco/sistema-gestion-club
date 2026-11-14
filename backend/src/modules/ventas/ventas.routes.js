import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as s from './ventas.schemas.js';
import * as controller from './ventas.controller.js';
import * as ds from '../devoluciones/devoluciones.schemas.js';
import * as devoluciones from '../devoluciones/devoluciones.controller.js';
import * as cs from '../cambios/cambios.schemas.js';
import * as cambios from '../cambios/cambios.controller.js';

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
router.get(
  '/:id',
  requirePermiso('ventas.consultar'),
  validate({ params: idParams }),
  controller.obtener,
);
router.post(
  '/:id/pagos',
  requirePermiso('ventas.cobrar'),
  validate({ params: idParams, body: s.cobrarBody }),
  controller.cobrar,
);

// 8. Devoluciones y anulaciones. Las rutas /previsualizar calculan sin guardar nada:
// cuánto se devuelve y en qué medio (para mostrarlo antes de confirmar).
const devolverPermiso = requirePermiso('devoluciones.registrar');
router.post(
  '/:id/devoluciones/previsualizar',
  devolverPermiso,
  validate({ params: idParams, body: ds.previsualizarDevolucionBody }),
  devoluciones.previsualizarDevolucion,
);
router.post(
  '/:id/devoluciones',
  devolverPermiso,
  validate({ params: idParams, body: ds.devolucionBody }),
  devoluciones.devolver,
);
router.post(
  '/:id/anular/previsualizar',
  devolverPermiso,
  validate({ params: idParams }),
  devoluciones.previsualizarAnulacion,
);
router.post(
  '/:id/anular',
  devolverPermiso,
  validate({ params: idParams, body: ds.anularBody }),
  devoluciones.anular,
);

// 9.1 Cambios de prenda sobre una venta registrada.
const cambiarPermiso = requirePermiso('cambios.registrar');
router.post(
  '/:id/cambios/previsualizar',
  cambiarPermiso,
  validate({ params: idParams, body: cs.previsualizarCambioBody }),
  cambios.previsualizar,
);
router.post(
  '/:id/cambios',
  cambiarPermiso,
  validate({ params: idParams, body: cs.cambioBody }),
  cambios.cambiar,
);

export default router;
