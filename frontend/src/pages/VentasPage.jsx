// 13.2 Ventas: por defecto las de hoy, con filtros y estado de pago. Clic → detalle.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listarVentas } from '../api/recursos.js';
import { Tabla, Paginacion } from '../components/Tabla.jsx';
import { Input, Select } from '../components/Campo.jsx';
import { Cargando } from '../components/Cargando.jsx';
import { EstadoPago } from '../features/ventas/EstadoPago.jsx';
import { formatearFechaHora, formatearPesos, hoy } from '../utils/formato.js';

export function VentasPage() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState({
    desde: hoy(),
    hasta: hoy(),
    estado_pago: '',
    pagina: 1,
  });
  const { data, isPending, error } = useQuery({
    queryKey: ['ventas', filtros],
    queryFn: () => listarVentas(filtros),
  });
  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value, pagina: 1 }));

  return (
    <section>
      <h1>Ventas</h1>
      <div className="filtros">
        <Input etiqueta="Desde" type="date" value={filtros.desde} onChange={set('desde')} />
        <Input etiqueta="Hasta" type="date" value={filtros.hasta} onChange={set('hasta')} />
        <Select
          etiqueta="Estado de pago"
          value={filtros.estado_pago}
          onChange={set('estado_pago')}
          vacio="Todos"
          opciones={[
            { valor: 'pagada', texto: 'Pagadas' },
            { valor: 'parcial', texto: 'Pago parcial' },
            { valor: 'pendiente', texto: 'Pendientes (fiado)' },
          ]}
        />
      </div>
      {error && <p className="alerta alerta--error">{error.message}</p>}
      {isPending ? (
        <Cargando />
      ) : (
        <>
          <Tabla
            filas={data?.ventas}
            vacio="No hay ventas en ese período."
            onFila={(v) => navigate(`/ventas/${v.id}`)}
            columnas={[
              { clave: 'id', titulo: 'N°' },
              { clave: 'fecha', titulo: 'Fecha', render: (v) => formatearFechaHora(v.fecha) },
              {
                clave: 'comprador',
                titulo: 'Comprador',
                render: (v) => v.comprador?.etiqueta ?? '—',
              },
              { clave: 'unidades', titulo: 'Prendas', alinear: 'derecha' },
              {
                clave: 'total',
                titulo: 'Total',
                alinear: 'derecha',
                render: (v) => formatearPesos(v.total),
              },
              {
                clave: 'deuda',
                titulo: 'Debe',
                alinear: 'derecha',
                render: (v) => (Number(v.deuda) > 0 ? formatearPesos(v.deuda) : ''),
              },
              { clave: 'estado_pago', titulo: 'Estado', render: (v) => <EstadoPago venta={v} /> },
            ]}
          />
          {data && (
            <Paginacion
              {...data.paginacion}
              onCambiar={(pagina) => setFiltros((f) => ({ ...f, pagina }))}
            />
          )}
        </>
      )}
    </section>
  );
}
