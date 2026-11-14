import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import usuariosRoutes from './modules/usuarios/usuarios.routes.js';
import productosRoutes from './modules/productos/productos.routes.js';
import stockRoutes from './modules/stock/stock.routes.js';

/** Router principal de la API: cada módulo se monta bajo su prefijo. */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/productos', productosRoutes);
router.use('/stock', stockRoutes);

export default router;
