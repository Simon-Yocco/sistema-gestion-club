import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { requireAuth } from '../../middlewares/auth.js';
import { loginSchema } from './auth.schemas.js';
import * as controller from './auth.controller.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), controller.login);
// Logout no exige sesión: siempre borra la cookie (por ejemplo si el token ya venció).
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);

export default router;
