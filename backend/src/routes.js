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
import {
  egresosRoutes,
  prestamosRoutes,
  transferenciasRoutes,
  saldosRoutes,
  movimientosRoutes,
} from './modules/fondos/fondos.routes.js';
import reportesRoutes from './modules/reportes/reportes.routes.js';

/**
 * Módulos de la API con su prefijo. Se exporta para que los tests (15.2 y 15.3) puedan
 * recorrer todos los endpoints automáticamente.
 */
export const MONTAJES = [
  ['/health', healthRoutes],
  ['/auth', authRoutes],
  ['/usuarios', usuariosRoutes],
  ['/productos', productosRoutes],
  ['/stock', stockRoutes],
  ['/ingresos', ingresosRoutes],
  ['/compradores', compradoresRoutes],
  ['/ventas', ventasRoutes],
  ['/deudores', deudoresRoutes],
  ['/egresos', egresosRoutes],
  ['/prestamos', prestamosRoutes],
  ['/transferencias-medios', transferenciasRoutes],
  ['/saldos', saldosRoutes],
  ['/movimientos', movimientosRoutes],
  ['/reportes', reportesRoutes],
];

/** Router principal de la API: cada módulo se monta bajo su prefijo. */
const router = Router();
for (const [prefijo, modulo] of MONTAJES) router.use(prefijo, modulo);

export default router;
