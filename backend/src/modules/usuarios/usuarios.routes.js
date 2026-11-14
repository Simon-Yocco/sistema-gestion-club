import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as s from './usuarios.schemas.js';
import * as controller from './usuarios.controller.js';

const router = Router();

router.use(requireAuth, requirePermiso('usuarios.gestionar'));

router.get('/', validate({ query: s.listarQuery }), controller.listar);
router.post('/', validate({ body: s.crearBody }), controller.crear);
router.get('/:id', validate({ params: s.idParams }), controller.obtener);
router.patch('/:id', validate({ params: s.idParams, body: s.editarBody }), controller.editar);
router.post(
  '/:id/password',
  validate({ params: s.idParams, body: s.resetPasswordBody }),
  controller.resetearPassword,
);
// Sin DELETE: los usuarios se desactivan (PATCH { activo: false }).

export default router;
