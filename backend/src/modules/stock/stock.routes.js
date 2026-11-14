import { Router } from 'express';
import { requireAuth, requirePermiso } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { consultarQuery } from './stock.schemas.js';
import * as controller from './stock.controller.js';

const router = Router();

router.get(
  '/',
  requireAuth,
  requirePermiso('stock.consultar'),
  validate({ query: consultarQuery }),
  controller.consultar,
);

export default router;
