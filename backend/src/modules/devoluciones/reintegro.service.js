// 8.1 Reintegro de dinero al cliente. Reutilizable por devoluciones, anulaciones y cambios.
//
// Cada reintegro crea un `pago` NEGATIVO (tipo 'devolucion') en la venta, así el pagado neto
// baja, y un movimiento de fondos NEGATIVO en el mismo medio (el dinero sale de la tienda).
import { Pago } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { toCents, fromCents, sum } from '../../utils/money.js';
import { MEDIOS_PAGO } from '../../config/constantes.js';
import * as movimientos from '../fondos/movimientos.service.js';

/**
 * Registra los reintegros. `reintegros` = [{ medio, monto (centavos > 0) }].
 * `tipoMovimiento`: 'devolucion_anulacion' o 'devolucion_diferencia_cambio'.
 */
export async function reintegrar(
  venta,
  reintegros,
  tipoMovimiento,
  usuario,
  transaction,
  descripcion,
) {
  const creados = [];
  for (const { medio, monto } of reintegros) {
    if (!Number.isSafeInteger(monto) || monto <= 0) {
      throw new Error(`Monto de reintegro inválido: ${monto}`);
    }
    const pago = await Pago.create(
      {
        venta_id: venta.id,
        medio,
        monto: fromCents(-monto),
        tipo: 'devolucion',
        usuario_id: usuario.id,
      },
      { transaction },
    );
    await movimientos.registrar(
      {
        medio,
        monto: -monto,
        tipo: tipoMovimiento,
        referencia_tipo: 'pago',
        referencia_id: pago.id,
        descripcion: descripcion ?? `Reintegro venta #${venta.id}`,
      },
      usuario,
      transaction,
    );
    creados.push(pago);
  }
  return creados;
}

/** Pagado neto de la venta por medio (cobros − reintegros), en centavos. */
export function pagadoPorMedio(venta) {
  const neto = Object.fromEntries(MEDIOS_PAGO.map((m) => [m, 0]));
  for (const p of venta.pagos ?? []) neto[p.medio] += toCents(p.monto);
  return neto;
}

/**
 * 8.4 Propone cómo reintegrar `monto`: "lo mismo que se cobró". Recorre los cobros del más
 * reciente al más viejo y toma de cada medio hasta lo que quedó cobrado neto en ese medio.
 * Ej.: cobrado $10.000 efectivo y luego $5.000 transferencia; devolver $6.000 →
 *      $5.000 por transferencia + $1.000 en efectivo.
 */
export function proponerReintegro(venta, monto) {
  if (monto <= 0) return [];
  const disponible = pagadoPorMedio(venta);
  const asignado = Object.fromEntries(MEDIOS_PAGO.map((m) => [m, 0]));
  let restante = monto;

  const cobros = [...(venta.pagos ?? [])]
    .filter((p) => p.tipo === 'cobro')
    .sort((a, b) => b.id - a.id);
  for (const { medio } of cobros) {
    if (restante <= 0) break;
    const tomar = Math.min(restante, disponible[medio] - asignado[medio]);
    if (tomar > 0) {
      asignado[medio] += tomar;
      restante -= tomar;
    }
  }
  // Si por algún motivo no alcanzó lo cobrado por medio, el resto va en efectivo.
  if (restante > 0) asignado.efectivo += restante;

  return MEDIOS_PAGO.filter((m) => asignado[m] > 0).map((medio) => ({
    medio,
    monto: asignado[medio],
  }));
}

/**
 * Decide los reintegros a registrar: los indicados por el usuario (tienen que sumar
 * exactamente `monto`) o, si no indicó, la propuesta por defecto.
 */
export function resolverReintegros(venta, monto, indicados) {
  if (!indicados || indicados.length === 0) return proponerReintegro(venta, monto);

  const suma = sum(indicados.map((r) => r.monto));
  if (suma !== monto) {
    throw AppError.badRequest(
      'REINTEGRO_NO_COINCIDE',
      monto === 0
        ? 'No corresponde devolver dinero en esta operación.'
        : `Hay que devolver $${fromCents(monto)} y el reintegro indicado suma $${fromCents(suma)}.`,
      { a_reintegrar: fromCents(monto), indicado: fromCents(suma) },
    );
  }
  return indicados;
}

/** Para mostrar: reintegros en centavos → [{ medio, monto: '0.00' }]. */
export const serializarReintegros = (reintegros) =>
  reintegros.map(({ medio, monto }) => ({ medio, monto: fromCents(monto) }));
