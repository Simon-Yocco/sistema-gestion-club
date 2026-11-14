// 3.6 Matriz de permisos (reglas de negocio, sección 2).
// Cada endpoint de negocio se protege con:  requireAuth, requirePermiso('<accion>')
// El administrador puede hacer todo (regla 2.2: "puede realizar también todas las
// operaciones de secretaría"), así que acá solo se listan los roles NO admin.

const SECRETARIA = ['secretaria'];
const SOLO_ADMIN = [];

/** acción → roles (además de admin) que pueden realizarla. */
export const PERMISOS = Object.freeze({
  // --- Secretaría (2.1)
  'ventas.registrar': SECRETARIA,
  'ventas.consultar': SECRETARIA,
  'ventas.cobrar': SECRETARIA, // cobros de venta y de fiado
  'cambios.registrar': SECRETARIA,
  'devoluciones.registrar': SECRETARIA, // devoluciones y anulaciones
  'egresos.registrar': SECRETARIA,
  'egresos.consultar': SECRETARIA,
  'prestamos.registrar': SECRETARIA, // préstamos de la comisión y sus devoluciones
  'transferencias_medios.registrar': SECRETARIA, // depósitos y extracciones bancarias
  'transferencias_medios.consultar': SECRETARIA,
  'stock.consultar': SECRETARIA,
  'deudores.consultar': SECRETARIA,
  // Necesarios para vender: buscar prendas y cargar compradores.
  'productos.consultar': SECRETARIA,
  'compradores.gestionar': SECRETARIA,
  // Saldos por medio y deuda con la comisión directiva (decisión 14/11/2026: secretaría
  // también los ve, para el indicador de su pantalla principal y la de préstamos).
  'saldos.consultar': SECRETARIA,

  // --- Solo administrador (2.2)
  'mercaderia.ingresar': SOLO_ADMIN,
  'mercaderia.consultar': SOLO_ADMIN,
  'productos.gestionar': SOLO_ADMIN, // crear/editar productos y variantes, cambiar precios
  'reportes.ver': SOLO_ADMIN,
  'movimientos.consultar': SOLO_ADMIN,
  'usuarios.gestionar': SOLO_ADMIN,
});

export function existeAccion(accion) {
  return Object.hasOwn(PERMISOS, accion);
}

/** ¿El rol puede realizar la acción? Lanza si la acción no existe (evita typos silenciosos). */
export function puede(rol, accion) {
  if (!existeAccion(accion)) throw new Error(`Acción de permiso desconocida: "${accion}"`);
  return rol === 'admin' || PERMISOS[accion].includes(rol);
}

/** Acciones permitidas para un rol (útil para que el frontend arme el menú). */
export function accionesDe(rol) {
  return Object.keys(PERMISOS).filter((accion) => puede(rol, accion));
}
