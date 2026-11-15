// Opciones del menú y la acción de permiso que requiere cada una (src/config/permisos.js
// del backend). El menú muestra solo las que el usuario puede usar.
// `grupo`: secretaria = operación diaria (pocas opciones, bien visibles) · admin = gestión.
// `enMenu: false`: la pantalla existe pero no va en la barra ("Nueva venta" se abre desde
// Ventas y desde el Inicio). `descripcion`: texto de la tarjeta en el Inicio.

export const MENU = [
  {
    ruta: '/ventas/nueva',
    texto: 'Nueva venta',
    permiso: 'ventas.registrar',
    grupo: 'secretaria',
    destacado: true,
    enMenu: false,
    descripcion: 'Cobrar prendas en efectivo, transferencia o fiado.',
  },
  {
    ruta: '/ventas',
    texto: 'Ventas',
    permiso: 'ventas.consultar',
    grupo: 'secretaria',
    descripcion: 'Buscar una venta para cobrar, cambiar, devolver o anular.',
  },
  {
    ruta: '/deudores',
    texto: 'Deudores',
    permiso: 'deudores.consultar',
    grupo: 'secretaria',
    descripcion: 'Quién debe y cuánto. Cobrar fiados.',
  },
  {
    ruta: '/prendas',
    texto: 'Prendas',
    permiso: 'productos.consultar',
    grupo: 'secretaria',
    descripcion: 'Ver las prendas, sus precios y qué talles quedan.',
  },
  {
    ruta: '/egresos',
    texto: 'Egresos',
    permiso: 'egresos.registrar',
    grupo: 'secretaria',
    descripcion: 'Registrar gastos pagados con plata de la tienda.',
  },
  {
    ruta: '/prestamos',
    texto: 'Préstamos',
    permiso: 'prestamos.registrar',
    grupo: 'secretaria',
    descripcion: 'Plata que la comisión presta o se le devuelve.',
  },
  {
    ruta: '/banco',
    texto: 'Depósitos',
    permiso: 'transferencias_medios.registrar',
    grupo: 'secretaria',
    descripcion: 'Pasar efectivo al banco o sacar del banco.',
  },

  { ruta: '/productos', texto: 'Productos', permiso: 'productos.gestionar', grupo: 'admin' },
  { ruta: '/ingresos', texto: 'Mercadería', permiso: 'mercaderia.ingresar', grupo: 'admin' },
  { ruta: '/reportes', texto: 'Reportes', permiso: 'reportes.ver', grupo: 'admin' },
  { ruta: '/movimientos', texto: 'Movimientos', permiso: 'movimientos.consultar', grupo: 'admin' },
  { ruta: '/usuarios', texto: 'Usuarios', permiso: 'usuarios.gestionar', grupo: 'admin' },
];

export const menuPara = (puede) => MENU.filter((item) => puede(item.permiso));
