import { Router } from 'express';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import usuariosRoutes from './modules/usuarios/usuarios.routes.js';
import productosRoutes from './modules/productos/productos.routes.js';
import stockRoutes from './modules/stock/stock.routes.js';
import ingresosRoutes from './modules/ingresos/ingresos.routes.js';
import compradoresRoutes from './modules/compradores/compradores.routes.js';
import ventasRoutes from './modules/ventas/ventas.routes.js';
import deudoresRoutes from './modules/deudores/deudores.routes.js';
import cambiosRoutes from './modules/cambios/cambios.routes.js';
import {
  egresosRoutes,
  prestamosRoutes,
  transferenciasRoutes,
} from './modules/fondos/fondos.routes.js';

/** Router principal de la API: cada módulo se monta bajo su prefijo. */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/productos', productosRoutes);
router.use('/stock', stockRoutes);
router.use('/ingresos', ingresosRoutes);
router.use('/compradores', compradoresRoutes);
router.use('/ventas', ventasRoutes);
router.use('/deudores', deudoresRoutes);
router.use('/cambios', cambiosRoutes);
router.use('/egresos', egresosRoutes);
router.use('/prestamos', prestamosRoutes);
router.use('/transferencias-medios', transferenciasRoutes);

export default router;
