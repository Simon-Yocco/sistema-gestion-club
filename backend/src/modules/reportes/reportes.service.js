// Reportes (Fase 11, reglas sección 14). Solo admin. Todos aceptan período desde/hasta
// (días de Argentina, inclusive); sin período, consideran todo.
//
// Cada función devuelve { periodo, ...datos, csv: { columnas, filas } }: `csv` es la tabla
// de detalle que se exporta con ?formato=csv (11.8) y no se envía en la respuesta JSON.
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../models/index.js';
import { toCents, fromCents, sum } from '../../utils/money.js';
import { inicioDiaArgentina, finDiaArgentina, aSQLUTC } from '../../utils/fechas.js';

const consulta = (sql, replacements = {}) =>
  sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

/** DECIMAL/SUM de una consulta → centavos. */
const c = (v) => toCents(String(v ?? 0));

/** Condiciones de período para una columna DATETIME (UTC) o DATE (calendario). */
function periodo(columna, { desde, hasta }, replacements, { esFecha = false } = {}) {
  const condiciones = [];
  if (desde) {
    condiciones.push(`${columna} >= :desde`);
    replacements.desde = esFecha ? desde : aSQLUTC(inicioDiaArgentina(desde));
  }
  if (hasta) {
    condiciones.push(`${columna} ${esFecha ? '<=' : '<'} :hasta`);
    replacements.hasta = esFecha ? hasta : aSQLUTC(finDiaArgentina(hasta));
  }
  return condiciones;
}

const where = (condiciones) => (condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '');
const per = ({ desde, hasta }) => ({ desde: desde ?? null, hasta: hasta ?? null });

/** Margen % con un decimal (ganancia / ingresos). null si no hubo ingresos. */
const margen = (ganancia, ingresos) =>
  ingresos === 0 ? null : Math.round((ganancia * 1000) / ingresos) / 10;

// ---------------------------------------------------------------- 11.1 Ventas por período

/**
 * Cantidad de ventas, unidades y total vendido, con detalle por producto, color y talle.
 * Excluye unidades devueltas y ventas anuladas.
 */
export async function ventas(filtros) {
  const r = {};
  const cond = ["v.estado = 'activa'", ...periodo('v.fecha', filtros, r)];
  const filas = await consulta(
    `SELECT p.id AS producto_id, p.nombre AS producto, va.id AS variante_id, va.color, va.talle,
            SUM(vi.cantidad - vi.cantidad_devuelta) AS unidades,
            SUM(vi.precio_unitario * (vi.cantidad - vi.cantidad_devuelta)) AS total
     FROM venta_item vi
     JOIN venta v ON v.id = vi.venta_id
     JOIN variante va ON va.id = vi.variante_id
     JOIN producto p ON p.id = va.producto_id
     ${where(cond)}
     GROUP BY p.id, p.nombre, va.id, va.color, va.talle
     HAVING unidades > 0
     ORDER BY total DESC, p.nombre, va.color, va.talle`,
    r,
  );
  const [{ cantidad }] = await consulta(
    `SELECT COUNT(DISTINCT v.id) AS cantidad
     FROM venta v JOIN venta_item vi ON vi.venta_id = v.id
     ${where([...cond, 'vi.cantidad > vi.cantidad_devuelta'])}`,
    r,
  );

  const detalle = filas.map((f) => ({
    producto_id: f.producto_id,
    producto: f.producto,
    variante_id: f.variante_id,
    color: f.color,
    talle: f.talle,
    unidades: Number(f.unidades),
    total: fromCents(c(f.total)),
  }));
  return {
    periodo: per(filtros),
    cantidad_ventas: Number(cantidad),
    unidades: detalle.reduce((a, d) => a + d.unidades, 0),
    total: fromCents(sum(detalle.map((d) => toCents(d.total)))),
    detalle,
    csv: {
      columnas: ['producto', 'color', 'talle', 'unidades', 'total'],
      filas: detalle,
    },
  };
}

// ---------------------------------------------------------------- 11.2 Ventas por medio de pago

/**
 * Lo cobrado y lo reintegrado en cada medio en el período, según los pagos (no según las
 * ventas). Los créditos de cambio sin venta no son dinero y no se cuentan.
 */
export async function ventasPorMedio(filtros) {
  const r = {};
  const cond = ['medio IS NOT NULL', ...periodo('fecha', filtros, r)];
  const filas = await consulta(
    `SELECT medio,
            COALESCE(SUM(CASE WHEN tipo = 'cobro' THEN monto END), 0) AS cobrado,
            COALESCE(-SUM(CASE WHEN tipo = 'devolucion' THEN monto END), 0) AS reintegrado
     FROM pago ${where(cond)}
     GROUP BY medio`,
    r,
  );
  const porMedio = Object.fromEntries(
    ['efectivo', 'transferencia'].map((medio) => {
      const f = filas.find((x) => x.medio === medio);
      const cobrado = c(f?.cobrado);
      const reintegrado = c(f?.reintegrado);
      return [medio, { cobrado, reintegrado, neto: cobrado - reintegrado }];
    }),
  );
  const fmt = (x) => ({
    cobrado: fromCents(x.cobrado),
    reintegrado: fromCents(x.reintegrado),
    neto: fromCents(x.neto),
  });
  const total = {
    cobrado: porMedio.efectivo.cobrado + porMedio.transferencia.cobrado,
    reintegrado: porMedio.efectivo.reintegrado + porMedio.transferencia.reintegrado,
    neto: porMedio.efectivo.neto + porMedio.transferencia.neto,
  };
  return {
    periodo: per(filtros),
    efectivo: fmt(porMedio.efectivo),
    transferencia: fmt(porMedio.transferencia),
    total: fmt(total),
    csv: {
      columnas: ['medio', 'cobrado', 'reintegrado', 'neto'],
      filas: [
        { medio: 'efectivo', ...fmt(porMedio.efectivo) },
        { medio: 'transferencia', ...fmt(porMedio.transferencia) },
        { medio: 'total', ...fmt(total) },
      ],
    },
  };
}

// ---------------------------------------------------------------- 11.3 Ganancia

/**
 * Ganancia = Σ (precio − costo) × unidades vigentes (regla 13), con precio y costo congelados
 * en cada ítem. Por período, por producto y por variante, con margen %.
 */
export async function ganancia(filtros) {
  const r = {};
  const cond = ["v.estado = 'activa'", ...periodo('v.fecha', filtros, r)];
  const filas = await consulta(
    `SELECT p.id AS producto_id, p.nombre AS producto, va.id AS variante_id, va.color, va.talle,
            SUM(vi.cantidad - vi.cantidad_devuelta) AS unidades,
            SUM(vi.precio_unitario * (vi.cantidad - vi.cantidad_devuelta)) AS ingresos,
            SUM(vi.costo_unitario * (vi.cantidad - vi.cantidad_devuelta)) AS costo
     FROM venta_item vi
     JOIN venta v ON v.id = vi.venta_id
     JOIN variante va ON va.id = vi.variante_id
     JOIN producto p ON p.id = va.producto_id
     ${where(cond)}
     GROUP BY p.id, p.nombre, va.id, va.color, va.talle
     HAVING unidades > 0`,
    r,
  );

  const linea = (ingresos, costo) => ({
    ingresos: fromCents(ingresos),
    costo: fromCents(costo),
    ganancia: fromCents(ingresos - costo),
    margen_pct: margen(ingresos - costo, ingresos),
  });

  const variantes = filas.map((f) => ({
    producto_id: f.producto_id,
    producto: f.producto,
    variante_id: f.variante_id,
    color: f.color,
    talle: f.talle,
    unidades: Number(f.unidades),
    _i: c(f.ingresos),
    _c: c(f.costo),
  }));

  const productos = new Map();
  for (const v of variantes) {
    const p = productos.get(v.producto_id) ?? {
      producto_id: v.producto_id,
      producto: v.producto,
      unidades: 0,
      _i: 0,
      _c: 0,
    };
    p.unidades += v.unidades;
    p._i += v._i;
    p._c += v._c;
    productos.set(v.producto_id, p);
  }

  const ordenar = (a, b) => b._i - b._c - (a._i - a._c);
  const limpiar = ({ _i, _c, ...resto }) => ({ ...resto, ...linea(_i, _c) });
  const porVariante = [...variantes].sort(ordenar).map(limpiar);
  const porProducto = [...productos.values()].sort(ordenar).map(limpiar);
  const totI = sum(variantes.map((v) => v._i));
  const totC = sum(variantes.map((v) => v._c));

  return {
    periodo: per(filtros),
    unidades: variantes.reduce((a, v) => a + v.unidades, 0),
    ...linea(totI, totC),
    por_producto: porProducto,
    por_variante: porVariante,
    csv: {
      columnas: [
        'producto',
        'color',
        'talle',
        'unidades',
        'ingresos',
        'costo',
        'ganancia',
        'margen_pct',
      ],
      filas: porVariante,
    },
  };
}
