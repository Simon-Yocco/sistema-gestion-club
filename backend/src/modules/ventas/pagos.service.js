// Pagos de una venta (reglas, sección 7). Cada cobro crea un `pago` positivo y un movimiento
// de fondos positivo en el mismo medio. Lo usan la venta (cobro_venta), los cobros de fiado
// (cobro_fiado) y los cambios (cobro_diferencia_cambio).
import { Pago } from '../../models/index.js';
import { fromCents } from '../../utils/money.js';
import * as movimientos from '../fondos/movimientos.service.js';

/**
 * Registra uno o varios cobros sobre una venta. `pagos` = [{ medio, monto (centavos > 0) }].
 * `tipoMovimiento` indica qué tipo de movimiento de fondos generan.
 */
export async function registrarCobros(venta, pagos, tipoMovimiento, usuario, transaction) {
  const creados = [];
  for (const { medio, monto } of pagos) {
    const pago = await Pago.create(
      { venta_id: venta.id, medio, monto: fromCents(monto), tipo: 'cobro', usuario_id: usuario.id },
      { transaction },
    );
    await movimientos.registrar(
      {
        medio,
        monto,
        tipo: tipoMovimiento,
        referencia_tipo: 'pago',
        referencia_id: pago.id,
        descripcion: `Venta #${venta.id}`,
      },
      usuario,
      transaction,
    );
    creados.push(pago);
  }
  return creados;
}
