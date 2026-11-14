import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as s from './compradores.schemas.js';
import * as controller from './compradores.controller.js';
import * as deudores from '../deudores/deudores.service.js';

const router = Router();
router.use(requireAuth);

const gestionar = requirePermiso('compradores.gestionar');

router.get('/', gestionar, validate({ query: s.listarQuery }), controller.listar);
router.post('/', gestionar, validate({ body: s.compradorBody }), controller.crear);
router.get('/:id', gestionar, validate({ params: idParams }), controller.obtener);
router.patch(
  '/:id',
  gestionar,
  validate({ params: idParams, body: s.editarBody }),
  controller.editar,
);
// Sin DELETE: los compradores tienen ventas asociadas y nada se borra.

// 7.3 Cuenta del comprador: sus ventas con la deuda de cada una, para cobrar desde ahí.
router.get(
  '/:id/cuenta',
  requirePermiso('deudores.consultar'),
  validate({ params: idParams }),
  async (req, res) => {
    res.json(await deudores.cuenta(req.validated.params.id));
  },
);

export default router;
