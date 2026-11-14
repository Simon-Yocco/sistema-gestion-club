// 10.5 Libro de movimientos de fondos, con saldo acumulado por fila.
import { sequelize } from '../../models/index.js';
import { toCents, fromCents } from '../../utils/money.js';
import { inicioDiaArgentina, finDiaArgentina, aISO, aSQLUTC } from '../../utils/fechas.js';

/**
 * Lista los movimientos del más reciente al más viejo. El saldo acumulado de cada fila es
 * el saldo después de ese movimiento:
 *  - filtrando por medio → saldo de ese medio;
 *  - sin medio → saldo total (efectivo + transferencia).
 * Se calcula sobre TODOS los movimientos (del medio), así que es correcto aunque se filtre
 * por fecha o por tipo.
 */
export async function listar({ desde, hasta, medio, tipo, pagina, por_pagina }) {
  const replacements = {};
  const internas = [];
  if (medio) {
    internas.push('m.medio = :medio');
    replacements.medio = medio;
  }
  const externas = [];
  if (desde) {
    externas.push('x.fecha >= :desde');
    replacements.desde = aSQLUTC(inicioDiaArgentina(desde));
  }
  if (hasta) {
    externas.push('x.fecha < :hasta');
    replacements.hasta = aSQLUTC(finDiaArgentina(hasta));
  }
  if (tipo) {
    externas.push('x.tipo = :tipo');
    replacements.tipo = tipo;
  }
  const whereInterno = internas.length ? `WHERE ${internas.join(' AND ')}` : '';
  const whereExterno = externas.length ? `WHERE ${externas.join(' AND ')}` : '';

  const base = `
    SELECT m.id, m.fecha, m.medio, m.monto, m.tipo, m.referencia_tipo, m.referencia_id,
           m.descripcion, m.usuario_id, u.nombre AS usuario_nombre,
           SUM(m.monto) OVER (ORDER BY m.fecha, m.id) AS saldo_acumulado
    FROM movimiento_fondos m
    JOIN usuario u ON u.id = m.usuario_id
    ${whereInterno}`;

  const [filas] = await sequelize.query(
    `SELECT * FROM (${base}) x ${whereExterno}
     ORDER BY x.fecha DESC, x.id DESC
     LIMIT :limite OFFSET :offset`,
    { replacements: { ...replacements, limite: por_pagina, offset: (pagina - 1) * por_pagina } },
  );
  const [[{ total }]] = await sequelize.query(
    `SELECT COUNT(*) AS total FROM (${base}) x ${whereExterno}`,
    { replacements },
  );

  const dinero = (v) => fromCents(toCents(String(v)));
  return {
    movimientos: filas.map((f) => ({
      id: f.id,
      fecha: aISO(f.fecha),
      medio: f.medio,
      monto: dinero(f.monto),
      tipo: f.tipo,
      referencia: f.referencia_tipo ? { tipo: f.referencia_tipo, id: f.referencia_id } : null,
      descripcion: f.descripcion,
      usuario: { id: f.usuario_id, nombre: f.usuario_nombre },
      saldo_acumulado: dinero(f.saldo_acumulado),
    })),
    paginacion: { pagina, por_pagina, total: Number(total) },
  };
}
