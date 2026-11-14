// Saldos de la tienda (reglas, sección 11). Nunca se guardan: siempre se calculan como la
// suma de los movimientos de fondos (principio 5). Se permite saldo negativo: el sistema
// avisa pero no bloquea (la comisión directiva suele prestarle dinero a la tienda).
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../models/index.js';
import { toCents, fromCents } from '../../utils/money.js';

/** Saldos por medio en centavos: { efectivo, transferencia }. */
export async function saldosEnCentavos({ transaction } = {}) {
  const filas = await sequelize.query(
    `SELECT medio, COALESCE(SUM(monto), 0) AS saldo FROM movimiento_fondos GROUP BY medio`,
    { type: QueryTypes.SELECT, transaction },
  );
  const saldos = { efectivo: 0, transferencia: 0 };
  for (const f of filas) saldos[f.medio] = toCents(String(f.saldo));
  return saldos;
}

/** Préstamos de la comisión en centavos: recibidos, devueltos y deuda (regla 11.1). */
export async function prestamosEnCentavos({ transaction } = {}) {
  const [fila] = await sequelize.query(
    `SELECT
       COALESCE(SUM(CASE WHEN tipo = 'prestamo_recibido' THEN monto END), 0) AS recibidos,
       COALESCE(-SUM(CASE WHEN tipo = 'devolucion_prestamo' THEN monto END), 0) AS devueltos
     FROM movimiento_fondos
     WHERE tipo IN ('prestamo_recibido', 'devolucion_prestamo')`,
    { type: QueryTypes.SELECT, transaction },
  );
  const recibidos = toCents(String(fila.recibidos));
  const devueltos = toCents(String(fila.devueltos));
  return { recibidos, devueltos, deuda: recibidos - devueltos };
}

/** 10.4 Saldos y deuda con la comisión, listos para la API. */
export async function resumen() {
  const saldos = await saldosEnCentavos();
  const prestamos = await prestamosEnCentavos();
  return {
    efectivo: fromCents(saldos.efectivo),
    transferencia: fromCents(saldos.transferencia),
    total: fromCents(saldos.efectivo + saldos.transferencia),
    deuda_comision: fromCents(prestamos.deuda),
    prestamos_recibidos: fromCents(prestamos.recibidos),
    prestamos_devueltos: fromCents(prestamos.devueltos),
  };
}

/**
 * Después de una operación que saca dinero: saldos actualizados y, si algún medio afectado
 * quedó negativo, la advertencia SALDO_NEGATIVO (no bloquea la operación).
 */
export async function saldosConAdvertencia(mediosAfectados, { transaction } = {}) {
  const saldos = await saldosEnCentavos({ transaction });
  const negativos = mediosAfectados.filter((m) => saldos[m] < 0);
  return {
    saldos: {
      efectivo: fromCents(saldos.efectivo),
      transferencia: fromCents(saldos.transferencia),
    },
    ...(negativos.length > 0
      ? {
          advertencia: {
            code: 'SALDO_NEGATIVO',
            message: `El saldo en ${negativos.join(' y ')} quedó negativo.`,
            medios: negativos,
          },
        }
      : {}),
  };
}
