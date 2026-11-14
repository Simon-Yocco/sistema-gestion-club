import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as s from './productos.schemas.js';
import * as controller from './productos.controller.js';

const router = Router();
router.use(requireAuth);

const consultar = requirePermiso('productos.consultar');
const gestionar = requirePermiso('productos.gestionar');

router.get('/', consultar, validate({ query: s.listarQuery }), controller.listar);
router.get('/:id', consultar, validate({ params: idParams }), controller.obtener);
router.post('/', gestionar, validate({ body: s.crearBody }), controller.crear);
router.patch(
  '/:id',
  gestionar,
  validate({ params: idParams, body: s.editarBody }),
  controller.editar,
);

router.post(
  '/:id/variantes',
  gestionar,
  validate({ params: idParams, body: s.agregarVariantesBody }),
  controller.agregarVariantes,
);
export default router;
