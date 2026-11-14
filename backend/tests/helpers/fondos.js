import { MovimientoFondos } from '../../src/models/index.js';
import { toCents, sum } from '../../src/utils/money.js';

/** Saldos por medio en centavos, sumando movimiento_fondos (como manda el principio 5). */
export async function saldos() {
  const movs = await MovimientoFondos.findAll();
  const de = (medio) => sum(movs.filter((m) => m.medio === medio).map((m) => toCents(m.monto)));
  return { efectivo: de('efectivo'), transferencia: de('transferencia') };
}
