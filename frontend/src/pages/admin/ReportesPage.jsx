// 14.5 Reportes: uno por pestaña, con filtro de fechas, totales, tabla y exportar a CSV.
// 14.6 Gráficos simples de ventas y ganancia por día y por producto.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { obtenerReporte, urlReporteCsv } from '../../api/admin.js';
import { Input } from '../../components/Campo.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Cargando } from '../../components/Cargando.jsx';
import { Barras } from '../../components/Barras.jsx';
import {
  aCentavos,
  formatearFecha,
  formatearFechaHora,
  formatearPesos,
  hoy,
} from '../../utils/formato.js';

const $ = (v) => formatearPesos(v);
const pct = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`);
const dinero = (clave, titulo) => ({
  clave,
  titulo,
  alinear: 'derecha',
  render: (f) => $(f[clave]),
});
const num = (clave, titulo) => ({ clave, titulo, alinear: 'derecha' });
const prenda = {
  clave: 'prenda',
  titulo: 'Prenda',
  render: (f) => `${f.producto} ${f.color} ${f.talle}`,
};

/** Configuración de cada reporte: totales, gráficos y columnas de la tabla. */
const REPORTES = {
  ventas: {
    titulo: 'Ventas',
    totales: (d) => [
      ['Ventas', d.cantidad_ventas],
      ['Prendas', d.unidades],
      ['Total', $(d.total)],
    ],
    graficos: (d) => [
      {
        titulo: 'Ventas por día',
        datos: d.por_dia.map((x) => ({
          etiqueta: formatearFecha(x.dia),
          valor: aCentavos(x.total),
          texto: $(x.total),
        })),
      },
    ],
    filas: (d) => d.detalle.map((x) => ({ ...x, id: x.variante_id })),
    columnas: [prenda, num('unidades', 'Unidades'), dinero('total', 'Total')],
  },
  'ventas-por-medio': {
    titulo: 'Por medio de pago',
    totales: (d) => [
      ['Neto efectivo', $(d.efectivo.neto)],
      ['Neto transferencia', $(d.transferencia.neto)],
      ['Total neto', $(d.total.neto)],
    ],
    filas: (d) => ['efectivo', 'transferencia', 'total'].map((m) => ({ id: m, medio: m, ...d[m] })),
    columnas: [
      {
        clave: 'medio',
        titulo: 'Medio',
        render: (f) => f.medio[0].toUpperCase() + f.medio.slice(1),
      },
      dinero('cobrado', 'Cobrado'),
      dinero('reintegrado', 'Reintegrado'),
      dinero('neto', 'Neto'),
    ],
  },
  ganancia: {
    titulo: 'Ganancia',
    totales: (d) => [
      ['Ingresos', $(d.ingresos)],
      ['Costo', $(d.costo)],
      ['Ganancia', $(d.ganancia)],
      ['Margen', pct(d.margen_pct)],
    ],
    graficos: (d) => [
      {
        titulo: 'Ganancia por día',
        datos: d.por_dia.map((x) => ({
          etiqueta: formatearFecha(x.dia),
          valor: aCentavos(x.ganancia),
          texto: $(x.ganancia),
        })),
      },
      {
        titulo: 'Ganancia por producto',
        datos: d.por_producto.map((x) => ({
          etiqueta: x.producto,
          valor: aCentavos(x.ganancia),
          texto: `${$(x.ganancia)} (${pct(x.margen_pct)})`,
        })),
      },
    ],
    filas: (d) => d.por_variante.map((x) => ({ ...x, id: x.variante_id })),
    columnas: [
      prenda,
      num('unidades', 'Unidades'),
      dinero('ingresos', 'Ingresos'),
      dinero('costo', 'Costo'),
      dinero('ganancia', 'Ganancia'),
      {
        clave: 'margen_pct',
        titulo: 'Margen',
        alinear: 'derecha',
        render: (f) => pct(f.margen_pct),
      },
    ],
  },
  'stock-valorizado': {
    titulo: 'Stock valorizado',
    sinFechas: true,
    totales: (d) => [
      ['Prendas', d.unidades],
      ['A costo', $(d.valor_costo)],
      ['A precio de venta', $(d.valor_venta)],
    ],
    filas: (d) => d.detalle.map((x) => ({ ...x, id: x.variante_id })),
    columnas: [
      prenda,
      num('unidades', 'Unidades'),
      dinero('valor_costo', 'A costo'),
      dinero('valor_venta', 'A precio'),
    ],
  },
  devoluciones: {
    titulo: 'Devoluciones y anulaciones',
    totales: (d) => [
      ['Devoluciones', d.cantidad_devoluciones],
      ['Anulaciones', d.cantidad_anulaciones],
      ['Monto', $(d.monto_total)],
    ],
    filas: (d) => d.detalle,
    columnas: [
      { clave: 'fecha', titulo: 'Fecha', render: (f) => formatearFechaHora(f.fecha) },
      {
        clave: 'tipo',
        titulo: 'Tipo',
        render: (f) => (f.tipo === 'anulacion' ? 'Anulación' : 'Devolución'),
      },
      num('venta_id', 'Venta'),
      { clave: 'comprador', titulo: 'Comprador' },
      dinero('monto', 'Monto'),
      { clave: 'motivo', titulo: 'Motivo' },
      { clave: 'usuario', titulo: 'Usuario' },
    ],
  },
  egresos: {
    titulo: 'Egresos',
    totales: (d) => [
      ['Egresos', d.cantidad],
      ['Total', $(d.total)],
    ],
    filas: (d) => d.por_concepto.map((x) => ({ ...x, id: x.concepto })),
    columnas: [
      {
        clave: 'concepto',
        titulo: 'Concepto',
        render: (f) => (f.concepto === 'mercaderia' ? 'Mercadería' : 'Otros gastos'),
      },
      num('cantidad', 'Cantidad'),
      dinero('efectivo', 'Efectivo'),
      dinero('transferencia', 'Transferencia'),
      dinero('total', 'Total'),
    ],
  },
  comision: {
    titulo: 'Comisión directiva',
    totales: (d) => [
      ['Recibido', $(d.recibido_en_periodo)],
      ['Devuelto', $(d.devuelto_en_periodo)],
      ['Deuda actual', $(d.deuda_actual)],
    ],
    filas: (d) => d.detalle,
    columnas: [
      { clave: 'fecha', titulo: 'Fecha', render: (f) => formatearFechaHora(f.fecha) },
      {
        clave: 'tipo',
        titulo: 'Tipo',
        render: (f) => (f.tipo === 'recibido' ? 'Préstamo' : 'Devolución'),
      },
      { clave: 'medio', titulo: 'Medio' },
      dinero('monto', 'Monto'),
      dinero('deuda_acumulada', 'Deuda después'),
    ],
  },
  depositos: {
    titulo: 'Depósitos y extracciones',
    totales: (d) => [
      ['Depósitos', $(d.total_depositos)],
      ['Extracciones', $(d.total_extracciones)],
    ],
    filas: (d) => d.detalle,
    columnas: [
      { clave: 'fecha', titulo: 'Fecha', render: (f) => formatearFecha(f.fecha) },
      {
        clave: 'tipo',
        titulo: 'Tipo',
        render: (f) => (f.tipo === 'deposito' ? 'Depósito' : 'Extracción'),
      },
      dinero('monto', 'Monto'),
      { clave: 'comprobante', titulo: 'Comprobante' },
    ],
  },
};

export function ReportesPage() {
  const [nombre, setNombre] = useState('ventas');
  const dia = hoy();
  const [fechas, setFechas] = useState({ desde: `${dia.slice(0, 8)}01`, hasta: dia });
  const config = REPORTES[nombre];
  const filtros = config.sinFechas ? {} : fechas;
  const { data, isPending, error } = useQuery({
    queryKey: ['reporte', nombre, filtros],
    queryFn: () => obtenerReporte(nombre, filtros),
  });

  return (
    <section>
      <h1>Reportes</h1>
      <nav className="pestanas" aria-label="Reportes">
        {Object.entries(REPORTES).map(([clave, r]) => (
          <button
            key={clave}
            type="button"
            className={`pestanas__item ${clave === nombre ? 'pestanas__item--activa' : ''}`}
            aria-current={clave === nombre ? 'page' : undefined}
            onClick={() => setNombre(clave)}
          >
            {r.titulo}
          </button>
        ))}
      </nav>
      <div className="filtros">
        {!config.sinFechas && (
          <>
            <Input
              etiqueta="Desde"
              type="date"
              value={fechas.desde}
              onChange={(e) => setFechas((f) => ({ ...f, desde: e.target.value }))}
            />
            <Input
              etiqueta="Hasta"
              type="date"
              value={fechas.hasta}
              onChange={(e) => setFechas((f) => ({ ...f, hasta: e.target.value }))}
            />
          </>
        )}
        <a className="boton boton--secundario" href={urlReporteCsv(nombre, filtros)} download>
          Exportar a Excel (CSV)
        </a>
      </div>
      {error && <p className="alerta alerta--error">{error.message}</p>}
      {isPending ? (
        <Cargando />
      ) : (
        data && (
          <>
            <dl className="totales totales--linea">
              {config.totales(data).map(([t, v]) => (
                <div key={t} className="totales__item">
                  <dt>{t}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {config.graficos?.(data).map((g) => (
              <Barras key={g.titulo} {...g} />
            ))}
            <Tabla
              filas={config.filas(data)}
              columnas={config.columnas}
              vacio="Sin datos en el período."
            />
          </>
        )
      )}
    </section>
  );
}
