// 6.3 Cálculos de una venta, como funciones puras (sin base de datos).
//
// Principio 6: el total, lo pagado, la deuda y el estado de pago NO se guardan; se calculan
// siempre a partir de los ítems y los pagos. Todas las funciones devuelven CENTAVOS.
//
// Formas esperadas (tal como vienen de la base, con DECIMAL como string):
//   venta = {
//     items: [{ cantidad, cantidad_devuelta, precio_unitario: '15000.00', costo_unitario: '8000.00' }],
//     pagos: [{ monto: '10000.00' }, { monto: '-2000.00' }],   // cobros +, devoluciones −
//   }
import { toCents, multiply, sum } from '../../utils/money.js';

/** Unidades que siguen vendidas en un ítem (vendidas − devueltas). */
export const cantidadVigente = (item) => item.cantidad - (item.cantidad_devuelta ?? 0);

/** Total vigente = Σ precio × (cantidad − cantidad_devuelta). */
export function totalVigente(venta) {
  return sum(
    (venta.items ?? []).map((i) => multiply(toCents(i.precio_unitario), cantidadVigente(i))),
  );
}

/** Pagado neto = Σ montos de los pagos (los reintegros son negativos). */
export function pagadoNeto(venta) {
  return sum((venta.pagos ?? []).map((p) => toCents(p.monto)));
}

/**
 * Deuda = total vigente − pagado neto. Negativa si se pagó de más respecto del total
 * vigente (por ejemplo, después de devolver una prenda): ese excedente hay que reintegrarlo.
 */
export function deuda(venta) {
  return totalVigente(venta) - pagadoNeto(venta);
}

/**
 * Estado de pago (regla 6):
 *   pagada    → pagos = total (o más, o la venta quedó en $0)
 *   parcial   → 0 < pagos < total
 *   pendiente → sin pagos (fiado total)
 */
export function estadoPago(venta) {
  const total = totalVigente(venta);
  const pagado = pagadoNeto(venta);
  if (pagado >= total) return 'pagada';
  if (pagado <= 0) return 'pendiente';
  return 'parcial';
}

/** Ganancia = Σ (precio − costo) × (cantidad − cantidad_devuelta) (regla 13). */
export function ganancia(venta) {
  return sum(
    (venta.items ?? []).map((i) =>
      multiply(toCents(i.precio_unitario) - toCents(i.costo_unitario), cantidadVigente(i)),
    ),
  );
}

/** Todos los cálculos juntos, en centavos. */
export function resumen(venta) {
  return {
    total: totalVigente(venta),
    pagado: pagadoNeto(venta),
    deuda: deuda(venta),
    estado_pago: estadoPago(venta),
    ganancia: ganancia(venta),
  };
}
