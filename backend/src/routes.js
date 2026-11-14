import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.js';

/** Router principal de la API: cada módulo se monta bajo su prefijo. */
const router = Router();

router.use('/health', healthRoutes);

export default router;
