// Libro de movimientos de fondos (reglas, sección 11). Toda entrada o salida de dinero de la
// tienda queda registrada acá, con su signo. El saldo por medio = SUM(monto) (principio 5).
import { MovimientoFondos } from '../../models/index.js';
import { fromCents } from '../../utils/money.js';
import { TIPOS_MOVIMIENTO, MEDIOS_PAGO } from '../../config/constantes.js';

/**
 * Registra un movimiento. `monto` va en CENTAVOS y con signo (+ entra, − sale).
 * Siempre dentro de la transacción de la operación que lo origina.
 */
export async function registrar(
  { medio, monto, tipo, referencia_tipo = null, referencia_id = null, descripcion = null },
  usuario,
  transaction,
) {
  if (!transaction) throw new Error('movimientos.registrar: se requiere una transacción.');
  if (!MEDIOS_PAGO.includes(medio)) throw new Error(`Medio inválido: ${medio}`);
  if (!TIPOS_MOVIMIENTO.includes(tipo)) throw new Error(`Tipo de movimiento inválido: ${tipo}`);
  if (!Number.isSafeInteger(monto) || monto === 0) {
    throw new Error(`Monto de movimiento inválido: ${monto}`);
  }

  return MovimientoFondos.create(
    {
      medio,
      monto: fromCents(monto),
      tipo,
      referencia_tipo,
      referencia_id,
      descripcion,
      usuario_id: usuario.id,
    },
    { transaction },
  );
}
