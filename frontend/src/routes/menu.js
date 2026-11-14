// Opciones del menú y la acción de permiso que requiere cada una (src/config/permisos.js
// del backend). El menú muestra solo las que el usuario puede usar.
// `grupo`: secretaria = operación diaria (pocas opciones, bien visibles) · admin = gestión.

export const MENU = [
  {
    ruta: '/ventas/nueva',
    texto: 'Nueva venta',
    permiso: 'ventas.registrar',
    grupo: 'secretaria',
    destacado: true,
  },
  { ruta: '/ventas', texto: 'Ventas', permiso: 'ventas.consultar', grupo: 'secretaria' },
  { ruta: '/deudores', texto: 'Deudores', permiso: 'deudores.consultar', grupo: 'secretaria' },
  { ruta: '/stock', texto: 'Stock', permiso: 'stock.consultar', grupo: 'secretaria' },
  {
    ruta: '/cambios/sin-venta',
    texto: 'Cambio sin venta',
    permiso: 'cambios.registrar',
    grupo: 'secretaria',
  },
  { ruta: '/egresos', texto: 'Egresos', permiso: 'egresos.registrar', grupo: 'secretaria' },
  { ruta: '/prestamos', texto: 'Préstamos', permiso: 'prestamos.registrar', grupo: 'secretaria' },
  {
    ruta: '/banco',
    texto: 'Depósitos',
    permiso: 'transferencias_medios.registrar',
    grupo: 'secretaria',
  },

  { ruta: '/productos', texto: 'Productos', permiso: 'productos.gestionar', grupo: 'admin' },
  { ruta: '/ingresos', texto: 'Mercadería', permiso: 'mercaderia.ingresar', grupo: 'admin' },
  { ruta: '/reportes', texto: 'Reportes', permiso: 'reportes.ver', grupo: 'admin' },
  { ruta: '/movimientos', texto: 'Movimientos', permiso: 'movimientos.consultar', grupo: 'admin' },
  { ruta: '/usuarios', texto: 'Usuarios', permiso: 'usuarios.gestionar', grupo: 'admin' },
];

export const menuPara = (puede) => MENU.filter((item) => puede(item.permiso));
