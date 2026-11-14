// Valores de los ENUM de la base, para usar en modelos, esquemas Zod y services.
// Si se agrega un valor acá, hace falta una migración que lo agregue a la columna.

export const ROLES = ['secretaria', 'admin'];
export const MEDIOS_PAGO = ['efectivo', 'transferencia'];
export const ESTADOS_VENTA = ['activa', 'anulada'];
export const ORIGENES_VENTA_ITEM = ['venta', 'cambio'];
export const TIPOS_PAGO = ['cobro', 'devolucion'];
export const TIPOS_DEVOLUCION = ['devolucion', 'anulacion'];
export const RESOLUCIONES_CAMBIO = ['sin_diferencia', 'cobro', 'devolucion', 'ajuste_deuda'];
export const CONCEPTOS_EGRESO = ['mercaderia', 'otro'];
export const TIPOS_TRANSFERENCIA_MEDIOS = ['deposito', 'extraccion'];

/** Tipos de movimiento de fondos (regla 11). El signo lo pone el service. */
export const TIPOS_MOVIMIENTO = [
  'cobro_venta',
  'cobro_fiado',
  'cobro_diferencia_cambio',
  'devolucion_diferencia_cambio',
  'devolucion_anulacion',
  'egreso',
  'prestamo_recibido',
  'devolucion_prestamo',
  'deposito_bancario',
  'extraccion_bancaria',
  'saldo_inicial',
];
