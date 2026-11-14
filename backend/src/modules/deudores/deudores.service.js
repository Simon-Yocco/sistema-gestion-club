// 7.2 Deudores (reglas, sección 8): compradores con fiado pendiente, con el monto adeudado
// y la antigüedad de la deuda (días desde la venta impaga más vieja).
import { sequelize } from '../../models/index.js';
import { toCents, fromCents, sum } from '../../utils/money.js';
import { aISO, diasDesde } from '../../utils/fechas.js';
import { SQL_VENTAS_CON_TOTALES } from '../ventas/ventas.service.js';
import {
  serializar as serializarComprador,
  buscar as buscarComprador,
} from '../compradores/compradores.service.js';

const ORDEN = {
  antiguedad: 'deuda_desde ASC, deuda DESC',
  monto: 'deuda DESC, deuda_desde ASC',
};

export async function listar({ orden }) {
  const [filas] = await sequelize.query(
    `SELECT c.id, c.nombre, c.apodo, c.numero_socio, c.telefono,
            SUM(x.deuda) AS deuda,
            COUNT(*) AS ventas_impagas,
            MIN(x.fecha) AS deuda_desde
     FROM (${SQL_VENTAS_CON_TOTALES}) x
     JOIN comprador c ON c.id = x.comprador_id
     WHERE x.estado = 'activa' AND x.deuda > 0
     GROUP BY c.id, c.nombre, c.apodo, c.numero_socio, c.telefono
     ORDER BY ${ORDEN[orden]}, c.nombre ASC`,
  );

  const deudores = filas.map((f) => {
    const desde = aISO(f.deuda_desde);
    return {
      comprador: serializarComprador(f),
      deuda: fromCents(toCents(String(f.deuda))),
      ventas_impagas: Number(f.ventas_impagas),
      deuda_desde: desde,
      antiguedad_dias: diasDesde(desde),
    };
  });

  return {
    deudores,
    total_adeudado: fromCents(sum(deudores.map((d) => toCents(d.deuda)))),
    cantidad: deudores.length,
  };
}

/**
 * 7.3 Cuenta de un comprador: sus ventas activas con total, pagado, deuda y estado de pago.
 * Primero las que tienen deuda (de la más vieja a la más nueva), después las pagadas.
 */
export async function cuenta(compradorId) {
  const comprador = await buscarComprador(compradorId);

  const [filas] = await sequelize.query(
    `SELECT x.* FROM (${SQL_VENTAS_CON_TOTALES}) x
     WHERE x.comprador_id = :compradorId AND x.estado = 'activa'
     ORDER BY (x.deuda > 0) DESC, x.fecha ASC, x.id ASC`,
    { replacements: { compradorId } },
  );

  const ventas = filas.map((f) => {
    const total = toCents(String(f.total));
    const pagado = toCents(String(f.pagado));
    const deuda = total - pagado;
    return {
      id: f.id,
      fecha: aISO(f.fecha),
      unidades: Number(f.unidades),
      total: fromCents(total),
      pagado: fromCents(pagado),
      deuda: fromCents(deuda),
      estado_pago: deuda <= 0 ? 'pagada' : pagado <= 0 ? 'pendiente' : 'parcial',
      antiguedad_dias: diasDesde(aISO(f.fecha)),
    };
  });
  const conDeuda = ventas.filter((v) => toCents(v.deuda) > 0);

  return {
    comprador: serializarComprador(comprador),
    deuda_total: fromCents(sum(conDeuda.map((v) => toCents(v.deuda)))),
    ventas_impagas: conDeuda.length,
    ventas,
  };
}
