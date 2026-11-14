// API de las pantallas de administración (fase 14).
import { get, patch, post, urlDescarga } from './cliente.js';

// Productos y variantes
export const listarProductosAdmin = (filtros) => get('/productos', filtros);
export const crearProducto = (datos) => post('/productos', datos);
export const editarProducto = (id, datos) => patch(`/productos/${id}`, datos);
export const agregarVariantes = (id, datos) => post(`/productos/${id}/variantes`, datos);
export const editarVariante = (id, varianteId, datos) =>
  patch(`/productos/${id}/variantes/${varianteId}`, datos);

// Ingresos de mercadería
export const crearIngreso = (datos) => post('/ingresos', datos);
export const listarIngresos = (filtros) => get('/ingresos', filtros);
export const obtenerIngreso = (id) => get(`/ingresos/${id}`);

// Usuarios
export const listarUsuarios = () => get('/usuarios');
export const crearUsuario = (datos) => post('/usuarios', datos);
export const editarUsuario = (id, datos) => patch(`/usuarios/${id}`, datos);
export const resetearPassword = (id, password) => post(`/usuarios/${id}/password`, { password });

// Reportes y movimientos
export const obtenerReporte = (nombre, filtros) => get(`/reportes/${nombre}`, filtros);
export const urlReporteCsv = (nombre, filtros) =>
  urlDescarga(`/reportes/${nombre}`, { ...filtros, formato: 'csv' });
export const listarMovimientos = (filtros) => get('/movimientos', filtros);
