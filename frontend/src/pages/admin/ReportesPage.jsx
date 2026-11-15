// 14.5 Reportes: Dinero (saldos de hoy, deuda con la comisión y lo cobrado por medio),
// Ganancia por producto y Valor del stock. Uno por pestaña, con fechas cuando corresponde.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { obtenerReporte } from '../../api/admin.js';
import { Input } from '../../components/Campo.jsx';
import { Tabla } from '../../components/Tabla.jsx';
import { Cargando } from '../../components/Cargando.jsx';
import { Barras } from '../../components/Barras.jsx';
import { aCentavos, formatearPesos, hoy } from '../../utils/formato.js';

const $ = (v) => formatearPesos(v);
const pct = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')} %`);
const dinero = (clave, titulo) => ({
  clave,
  titulo,
  alinear: 'derecha',
  render: (f) => $(f[clave]),
});
const num = (clave, titulo) => ({ clave, titulo, alinear: 'derecha' });

/**
 * Configuración de cada reporte: totales (tarjetas), gráficos y columnas de la tabla.
 * Quedan los tres que sirven para el negocio (las ventas se ven en la pantalla Ventas).
 */
const REPORTES = {
  'ventas-por-medio': {
    titulo: 'Dinero',
    // Cómo está la plata hoy: saldo por medio y deuda con la comisión (sin fechas).
    sinFechas: true,
    totales: (d) => [
      ['Efectivo hoy', $(d.saldo_actual.efectivo)],
      ['Transferencia hoy', $(d.saldo_actual.transferencia)],
      ['Total', $(d.saldo_actual.total)],
      ['Se le debe a la comisión', $(d.saldo_actual.deuda_comision)],
    ],
  },
  ganancia: {
    titulo: 'Ganancia por producto',
    totales: (d) => [
      ['Vendido', $(d.ingresos)],
      ['Costo', $(d.costo)],
      ['Ganancia', $(d.ganancia)],
      ['Margen', pct(d.margen_pct)],
    ],
    graficos: (d) => [
      {
        titulo: 'Ganancia por producto',
        datos: d.por_producto.map((x) => ({
          etiqueta: x.producto,
          valor: aCentavos(x.ganancia),
          texto: `${$(x.ganancia)} (${pct(x.margen_pct)})`,
        })),
      },
    ],
    filas: (d) => d.por_producto.map((x) => ({ ...x, id: x.producto_id })),
    columnas: [
      { clave: 'producto', titulo: 'Producto' },
      num('unidades', 'Unidades'),
      dinero('ingresos', 'Vendido'),
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
    titulo: 'Valor del stock',
    sinFechas: true,
    totales: (d) => [
      ['Prendas', d.unidades],
      ['Invertido (a costo)', $(d.valor_costo)],
      ['Ganancia potencial', $(d.ganancia_potencial)],
    ],
    // Una fila por producto: precio y costo no cambian con el talle ni el color.
    filas: (d) => d.detalle.map((x) => ({ ...x, id: x.producto_id })),
    columnas: [
      { clave: 'producto', titulo: 'Producto' },
      num('unidades', 'Cantidad'),
      dinero('costo_unitario', 'Precio de compra'),
      dinero('precio_venta', 'Precio de venta'),
      dinero('margen_unitario', 'Margen por unidad'),
      {
        clave: 'margen_pct',
        titulo: 'Margen',
        alinear: 'derecha',
        render: (f) => pct(f.margen_pct),
      },
      dinero('ganancia_potencial', 'Ganancia potencial'),
    ],
  },
};

export function ReportesPage() {
  const [nombre, setNombre] = useState('ventas-por-medio');
  const dia = hoy();
  const [fechas, setFechas] = useState({ desde: `${dia.slice(0, 8)}01`, hasta: dia });
  const config = REPORTES[nombre];
  const filtros = config.sinFechas ? {} : fechas;
  const { data, isPending, error } = useQuery({
    queryKey: ['reporte', nombre, filtros],
    queryFn: () => obtenerReporte(nombre, filtros),
  });

  const fechasInputs = !config.sinFechas && (
    <div className="filtros">
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
    </div>
  );
  const tarjetas = data && (
    <dl className="totales totales--linea">
      {config.totales(data).map(([t, v]) => (
        <div key={t} className="totales__item">
          <dt>{t}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );

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
      {fechasInputs}
      {error && <p className="alerta alerta--error">{error.message}</p>}
      {isPending ? (
        <Cargando />
      ) : (
        data && (
          <>
            {tarjetas}
            {config.graficos?.(data).map((g) => (
              <Barras key={g.titulo} {...g} />
            ))}
            {config.filas && (
              <Tabla
                filas={config.filas(data)}
                columnas={config.columnas}
                vacio="Sin datos en el período."
              />
            )}
          </>
        )
      )}
    </section>
  );
}
