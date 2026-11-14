import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { loginSchema } from './auth.schemas.js';
import * as controller from './auth.controller.js';

const router = Router();

router.post('/login', validate({ body: loginSchema }), controller.login);

export default router;
