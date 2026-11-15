// Reportes (Fase 11, reglas sección 14). Solo admin. Todos aceptan período desde/hasta
// (días de Argentina, inclusive); sin período, consideran todo.
//
// Cada función devuelve { periodo, ...datos, csv: { columnas, filas } }: `csv` es la tabla
// de detalle que se exporta con ?formato=csv (11.8) y no se envía en la respuesta JSON.
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../models/index.js';
import { toCents, fromCents, sum } from '../../utils/money.js';
import { inicioDiaArgentina, finDiaArgentina, aISO, aSQLUTC } from '../../utils/fechas.js';
import { resumen as resumenSaldos } from '../fondos/saldos.service.js';

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

/**
 * 14.6 Serie por día (en hora de Argentina, UTC−3) de ventas activas: unidades, ingresos y
 * costo de las prendas vigentes. Para los gráficos de ventas y ganancia.
 */
async function porDia(filtros) {
  const r = {};
  const cond = ["v.estado = 'activa'", ...periodo('v.fecha', filtros, r)];
  const filas = await consulta(
    `SELECT DATE_FORMAT(CONVERT_TZ(v.fecha, '+00:00', '-03:00'), '%Y-%m-%d') AS dia,
            SUM(vi.cantidad - vi.cantidad_devuelta) AS unidades,
            SUM(vi.precio_unitario * (vi.cantidad - vi.cantidad_devuelta)) AS ingresos,
            SUM(vi.costo_unitario * (vi.cantidad - vi.cantidad_devuelta)) AS costo
     FROM venta_item vi JOIN venta v ON v.id = vi.venta_id
     ${where(cond)}
     GROUP BY dia HAVING unidades > 0 ORDER BY dia`,
    r,
  );
  return filas.map((f) => ({
    dia: f.dia,
    unidades: Number(f.unidades),
    ingresos: c(f.ingresos),
    costo: c(f.costo),
  }));
}

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
    por_dia: (await porDia(filtros)).map((d) => ({
      dia: d.dia,
      unidades: d.unidades,
      total: fromCents(d.ingresos),
    })),
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
 * `saldo_actual`: cuánto hay hoy en efectivo y en transferencia y cuánto se le debe a la
 * comisión directiva (no depende del período).
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
  const saldos = await resumenSaldos();
  return {
    periodo: per(filtros),
    saldo_actual: {
      efectivo: saldos.efectivo,
      transferencia: saldos.transferencia,
      total: saldos.total,
      deuda_comision: saldos.deuda_comision,
    },
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
    por_dia: (await porDia(filtros)).map((d) => ({ dia: d.dia, ...linea(d.ingresos, d.costo) })),
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

// ---------------------------------------------------------------- 11.4 Stock valorizado

/**
 * Por producto (el precio y el costo son únicos por producto, así que el talle y el color no
 * cambian nada): unidades en stock, costo y precio unitarios, margen por unidad y ganancia
 * potencial si se vendiera todo. Solo productos con stock.
 */
export async function stockValorizado() {
  const filas = await consulta(
    `SELECT p.id AS producto_id, p.nombre AS producto, p.marca, p.activo,
            p.costo, p.precio_venta, SUM(va.stock) AS unidades
     FROM variante va JOIN producto p ON p.id = va.producto_id
     WHERE va.stock > 0
     GROUP BY p.id, p.nombre, p.marca, p.activo, p.costo, p.precio_venta
     ORDER BY p.nombre`,
  );
  const detalle = filas.map((f) => {
    const unidades = Number(f.unidades);
    const costo = c(f.costo);
    const precio = c(f.precio_venta);
    return {
      producto_id: f.producto_id,
      producto: f.producto,
      marca: f.marca ?? null,
      activo: Boolean(f.activo),
      unidades,
      costo_unitario: fromCents(costo),
      precio_venta: fromCents(precio),
      margen_unitario: fromCents(precio - costo),
      margen_pct: margen(precio - costo, precio),
      valor_costo: fromCents(costo * unidades),
      valor_venta: fromCents(precio * unidades),
      ganancia_potencial: fromCents((precio - costo) * unidades),
    };
  });
  const total = (campo) => sum(detalle.map((d) => toCents(d[campo])));
  return {
    periodo: per({}),
    unidades: detalle.reduce((a, d) => a + d.unidades, 0),
    valor_costo: fromCents(total('valor_costo')),
    valor_venta: fromCents(total('valor_venta')),
    ganancia_potencial: fromCents(total('ganancia_potencial')),
    detalle,
    csv: {
      columnas: [
        'producto',
        'unidades',
        'costo_unitario',
        'precio_venta',
        'margen_unitario',
        'margen_pct',
        'ganancia_potencial',
      ],
      filas: detalle,
    },
  };
}

// ---------------------------------------------------------------- 11.5 Anulaciones y devoluciones

/** Devoluciones y anulaciones con fecha, venta, monto de las prendas, motivo y usuario. */
export async function devoluciones(filtros) {
  const r = {};
  const filas = await consulta(
    `SELECT d.id, d.fecha, d.tipo, d.motivo, d.venta_id,
            u.nombre AS usuario, c.nombre AS comprador,
            COALESCE(SUM(di.cantidad), 0) AS unidades,
            COALESCE(SUM(di.cantidad * vi.precio_unitario), 0) AS monto
     FROM devolucion d
     JOIN usuario u ON u.id = d.usuario_id
     JOIN venta v ON v.id = d.venta_id
     LEFT JOIN comprador c ON c.id = v.comprador_id
     LEFT JOIN devolucion_item di ON di.devolucion_id = d.id
     LEFT JOIN venta_item vi ON vi.id = di.venta_item_id
     ${where(periodo('d.fecha', filtros, r))}
     GROUP BY d.id, d.fecha, d.tipo, d.motivo, d.venta_id, u.nombre, c.nombre
     ORDER BY d.fecha DESC, d.id DESC`,
    r,
  );
  const detalle = filas.map((f) => ({
    id: f.id,
    fecha: aISO(f.fecha),
    tipo: f.tipo,
    venta_id: f.venta_id,
    comprador: f.comprador,
    unidades: Number(f.unidades),
    monto: fromCents(c(f.monto)),
    motivo: f.motivo,
    usuario: f.usuario,
  }));
  const deTipo = (t) => detalle.filter((d) => d.tipo === t);
  return {
    periodo: per(filtros),
    cantidad_devoluciones: deTipo('devolucion').length,
    cantidad_anulaciones: deTipo('anulacion').length,
    monto_total: fromCents(sum(detalle.map((d) => toCents(d.monto)))),
    detalle,
    csv: {
      columnas: [
        'fecha',
        'tipo',
        'venta_id',
        'comprador',
        'unidades',
        'monto',
        'motivo',
        'usuario',
      ],
      filas: detalle,
    },
  };
}

// ---------------------------------------------------------------- 11.6 Egresos por concepto

export async function egresos(filtros) {
  const r = {};
  const filas = await consulta(
    `SELECT concepto, COUNT(*) AS cantidad, SUM(monto) AS total,
            COALESCE(SUM(CASE WHEN medio = 'efectivo' THEN monto END), 0) AS efectivo,
            COALESCE(SUM(CASE WHEN medio = 'transferencia' THEN monto END), 0) AS transferencia
     FROM egreso ${where(periodo('fecha', filtros, r, { esFecha: true }))}
     GROUP BY concepto ORDER BY concepto`,
    r,
  );
  const porConcepto = filas.map((f) => ({
    concepto: f.concepto,
    cantidad: Number(f.cantidad),
    total: fromCents(c(f.total)),
    efectivo: fromCents(c(f.efectivo)),
    transferencia: fromCents(c(f.transferencia)),
  }));
  return {
    periodo: per(filtros),
    cantidad: porConcepto.reduce((a, p) => a + p.cantidad, 0),
    total: fromCents(sum(porConcepto.map((p) => toCents(p.total)))),
    por_concepto: porConcepto,
    csv: {
      columnas: ['concepto', 'cantidad', 'efectivo', 'transferencia', 'total'],
      filas: porConcepto,
    },
  };
}

// ---------------------------------------------------------------- 11.7 Deuda con la comisión

/** Historial de préstamos y devoluciones con la deuda acumulada después de cada uno. */
export async function comision(filtros) {
  const r = {};
  const base = `
    SELECT m.id, m.fecha, m.tipo, m.medio, m.monto, m.descripcion, u.nombre AS usuario,
           SUM(m.monto) OVER (ORDER BY m.fecha, m.id) AS deuda_acumulada
    FROM movimiento_fondos m JOIN usuario u ON u.id = m.usuario_id
    WHERE m.tipo IN ('prestamo_recibido', 'devolucion_prestamo')`;
  const filas = await consulta(
    `SELECT * FROM (${base}) x ${where(periodo('x.fecha', filtros, r))}
     ORDER BY x.fecha DESC, x.id DESC`,
    r,
  );
  const detalle = filas.map((f) => ({
    id: f.id,
    fecha: aISO(f.fecha),
    tipo: f.tipo === 'prestamo_recibido' ? 'recibido' : 'devolucion',
    medio: f.medio,
    monto: fromCents(Math.abs(c(f.monto))),
    descripcion: f.descripcion,
    usuario: f.usuario,
    deuda_acumulada: fromCents(c(f.deuda_acumulada)),
  }));
  const deTipo = (t) => sum(detalle.filter((d) => d.tipo === t).map((d) => toCents(d.monto)));
  const [{ deuda }] = await consulta(
    `SELECT COALESCE(SUM(monto), 0) AS deuda FROM movimiento_fondos
     WHERE tipo IN ('prestamo_recibido', 'devolucion_prestamo')`,
  );
  return {
    periodo: per(filtros),
    recibido_en_periodo: fromCents(deTipo('recibido')),
    devuelto_en_periodo: fromCents(deTipo('devolucion')),
    deuda_actual: fromCents(c(deuda)),
    detalle,
    csv: {
      columnas: ['fecha', 'tipo', 'medio', 'monto', 'deuda_acumulada', 'descripcion', 'usuario'],
      filas: detalle,
    },
  };
}

// ---------------------------------------------------------------- 11.7b Depósitos y extracciones

export async function depositos(filtros) {
  const r = {};
  const filas = await consulta(
    `SELECT t.id, t.fecha, t.tipo, t.monto, t.descripcion, t.comprobante, u.nombre AS usuario
     FROM transferencia_medios t JOIN usuario u ON u.id = t.usuario_id
     ${where(periodo('t.fecha', filtros, r, { esFecha: true }))}
     ORDER BY t.fecha DESC, t.id DESC`,
    r,
  );
  const detalle = filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    tipo: f.tipo,
    monto: fromCents(c(f.monto)),
    descripcion: f.descripcion,
    comprobante: f.comprobante,
    usuario: f.usuario,
  }));
  const total = (t) =>
    fromCents(sum(detalle.filter((d) => d.tipo === t).map((d) => toCents(d.monto))));
  return {
    periodo: per(filtros),
    total_depositos: total('deposito'),
    total_extracciones: total('extraccion'),
    detalle,
    csv: {
      columnas: ['fecha', 'tipo', 'monto', 'comprobante', 'descripcion', 'usuario'],
      filas: detalle,
    },
  };
}
