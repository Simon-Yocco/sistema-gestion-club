// Recorre todos los endpoints de la API (src/routes.js → MONTAJES) para las revisiones
// automáticas de permisos (15.2) y validaciones (15.3).
import { MONTAJES } from '../../src/routes.js';

/**
 * Lista [{ metodo, ruta, acciones }] de cada endpoint. `acciones` son las acciones de
 * permiso que exige (las de los `router.use(...)` del módulo y las de la ruta).
 */
export function listarEndpoints() {
  const endpoints = [];
  for (const [prefijo, router] of MONTAJES) {
    const accionesModulo = [];
    for (const capa of router.stack) {
      if (!capa.route) {
        if (capa.handle?.accion) accionesModulo.push(capa.handle.accion);
        continue;
      }
      const accionesRuta = capa.route.stack.map((c) => c.handle?.accion).filter(Boolean);
      for (const metodo of Object.keys(capa.route.methods)) {
        endpoints.push({
          metodo,
          ruta: `/api${prefijo}${capa.route.path === '/' ? '' : capa.route.path}`,
          acciones: [...accionesModulo, ...accionesRuta],
        });
      }
    }
  }
  return endpoints;
}

/** Reemplaza los parámetros (:id, :varianteId) por un valor. */
export const conParametros = (ruta, valor = 1) => ruta.replace(/:[a-zA-Z]+/g, String(valor));

/** Endpoints que no requieren sesión. */
export const PUBLICOS = ['GET /api/health', 'POST /api/auth/login', 'POST /api/auth/logout'];
