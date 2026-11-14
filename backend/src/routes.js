import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';

/** Router principal de la API: cada módulo se monta bajo su prefijo. */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

export default router;
