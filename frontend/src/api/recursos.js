// Funciones de la API por recurso. El dinero se manda como string ("15000.50"): usar
// desdeCentavos() antes de llamar.
import { get, post } from './cliente.js';

// Productos y stock
export const buscarProductos = (q) => get('/productos', { q });
export const obtenerProducto = (id) => get(`/productos/${id}`);
export const consultarStock = (filtros) => get('/stock', filtros);

// Compradores
export const buscarCompradores = (q) => get('/compradores', { q, limite: 10 });
export const cuentaComprador = (id) => get(`/compradores/${id}/cuenta`);
export const listarDeudores = (orden) => get('/deudores', { orden });

// Ventas
export const crearVenta = (datos) => post('/ventas', datos);
export const listarVentas = (filtros) => get('/ventas', filtros);
export const obtenerVenta = (id) => get(`/ventas/${id}`);
export const cobrarVenta = (id, pagos) => post(`/ventas/${id}/pagos`, { pagos });
export const previsualizarDevolucion = (id, items) =>
  post(`/ventas/${id}/devoluciones/previsualizar`, { items });
export const devolver = (id, datos) => post(`/ventas/${id}/devoluciones`, datos);
export const previsualizarAnulacion = (id) => post(`/ventas/${id}/anular/previsualizar`);
export const anular = (id, datos) => post(`/ventas/${id}/anular`, datos);
export const previsualizarCambio = (id, datos) =>
  post(`/ventas/${id}/cambios/previsualizar`, datos);
export const cambiar = (id, datos) => post(`/ventas/${id}/cambios`, datos);
export const cambiarSinVenta = (datos) => post('/cambios/sin-venta', datos);

// Fondos
export const obtenerSaldos = () => get('/saldos');
export const crearEgreso = (datos) => post('/egresos', datos);
export const listarEgresos = (filtros) => get('/egresos', filtros);
export const registrarPrestamo = (datos) => post('/prestamos', datos);
export const listarPrestamos = () => get('/prestamos', { por_pagina: 20 });
export const registrarTransferencia = (datos) => post('/transferencias-medios', datos);
export const listarTransferencias = () => get('/transferencias-medios', { por_pagina: 20 });

/** Claves de TanStack Query que hay que invalidar cuando se mueve dinero o stock. */
export const CLAVES_DINERO = [
  ['saldos'],
  ['ventas'],
  ['venta'],
  ['deudores'],
  ['cuenta'],
  ['egresos'],
  ['ingresos'], // un egreso de mercadería cambia el estado de pago del ingreso
  ['movimientos'],
  ['reporte'],
];
export const CLAVES_STOCK = [['stock'], ['productos'], ['producto']];
