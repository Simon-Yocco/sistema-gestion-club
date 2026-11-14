import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/schemas.js';
import * as s from './compradores.schemas.js';
import * as controller from './compradores.controller.js';

const router = Router();
router.use(requireAuth, requirePermiso('compradores.gestionar'));

router.get('/', validate({ query: s.listarQuery }), controller.listar);
router.post('/', validate({ body: s.compradorBody }), controller.crear);
router.get('/:id', validate({ params: idParams }), controller.obtener);
router.patch('/:id', validate({ params: idParams, body: s.editarBody }), controller.editar);
// Sin DELETE: los compradores tienen ventas asociadas y nada se borra.

export default router;
