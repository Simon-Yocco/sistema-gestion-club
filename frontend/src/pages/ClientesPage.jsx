// Clientes (antes "Deudores"): todos los compradores con lo que deben, sus compras y la
// última. Filtro para ver solo los deudores. Clic → la cuenta del cliente, para cobrar.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { cuentaComprador, listarClientes } from '../api/recursos.js';
import { useDemorado } from '../hooks/useDemorado.js';
import { Tabla } from '../components/Tabla.jsx';
import { Input, Select } from '../components/Campo.jsx';
import { Cargando } from '../components/Cargando.jsx';
import { EstadoPago } from '../features/ventas/EstadoPago.jsx';
import { formatearFecha, formatearFechaHora, formatearPesos } from '../utils/formato.js';

const dias = (n) => (n === 0 ? 'hoy' : n === 1 ? '1 día' : `${n} días`);

export function ClientesPage() {
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  // /clientes?mostrar=deudores abre directo con el filtro (lo usa el dashboard).
  const [params] = useSearchParams();
  const [soloDeudores, setSoloDeudores] = useState(params.get('mostrar') === 'deudores');
  const [orden, setOrden] = useState('nombre');
  const q = useDemorado(texto.trim());
  const filtros = { q, solo_deudores: soloDeudores, orden };
  const { data, isPending, error } = useQuery({
    queryKey: ['deudores', 'clientes', filtros],
    queryFn: () => listarClientes(filtros),
  });

  return (
    <section>
      <h1>Clientes</h1>
      <div className="filtros">
        <Input
          etiqueta="Buscar (nombre, apodo o teléfono)"
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Select
          etiqueta="Mostrar"
          value={soloDeudores ? 'deudores' : 'todos'}
          onChange={(e) => setSoloDeudores(e.target.value === 'deudores')}
          opciones={[
            { valor: 'todos', texto: 'Todos los clientes' },
            { valor: 'deudores', texto: 'Solo los que deben' },
          ]}
        />
        <Select
          etiqueta="Ordenar por"
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          opciones={[
            { valor: 'nombre', texto: 'Nombre' },
            { valor: 'monto', texto: 'El que más debe' },
            { valor: 'antiguedad', texto: 'Deuda más vieja' },
            { valor: 'ultima_compra', texto: 'Compra más reciente' },
          ]}
        />
      </div>
      {error && <p className="alerta alerta--error">{error.message}</p>}
      {isPending ? (
        <Cargando />
      ) : (
        <>
          <p className="centrado">
            {data.cantidad} {data.cantidad === 1 ? 'cliente' : 'clientes'} ·{' '}
            {data.deudores === 0 ? (
              'nadie debe nada'
            ) : (
              <>
                {data.deudores} {data.deudores === 1 ? 'debe' : 'deben'} en total{' '}
                <strong>{formatearPesos(data.total_adeudado)}</strong>
              </>
            )}
          </p>
          <Tabla
            filas={data.clientes.map((c) => ({ ...c, id: c.comprador.id }))}
            vacio={soloDeudores ? 'Nadie debe nada.' : 'No hay clientes con esa búsqueda.'}
            onFila={(c) => navigate(`/clientes/${c.comprador.id}`)}
            columnas={[
              { clave: 'comprador', titulo: 'Cliente', render: (c) => c.comprador.etiqueta },
              { clave: 'telefono', titulo: 'Teléfono', render: (c) => c.comprador.telefono },
              { clave: 'compras', titulo: 'Compras', alinear: 'derecha' },
              {
                clave: 'ultima_compra',
                titulo: 'Última compra',
                render: (c) => (c.ultima_compra ? formatearFecha(c.ultima_compra) : '—'),
              },
              {
                clave: 'deuda',
                titulo: 'Debe',
                alinear: 'derecha',
                render: (c) =>
                  Number(c.deuda) > 0 ? (
                    <strong className="pendiente">{formatearPesos(c.deuda)}</strong>
                  ) : (
                    '—'
                  ),
              },
              {
                clave: 'antiguedad_dias',
                titulo: 'Debe desde hace',
                render: (c) => (c.antiguedad_dias === null ? '' : dias(c.antiguedad_dias)),
              },
            ]}
          />
        </>
      )}
    </section>
  );
}

/** Cuenta de un cliente: sus ventas (primero las que deben), para ir a cobrar cada una. */
export function CuentaCompradorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isPending, error } = useQuery({
    queryKey: ['cuenta', id],
    queryFn: () => cuentaComprador(id),
  });
  if (isPending) return <Cargando />;
  if (error) return <p className="alerta alerta--error">{error.message}</p>;
  const debe = Number(data.deuda_total) > 0;

  return (
    <section>
      <p>
        <Link to="/clientes">← Clientes</Link>
      </p>
      <h1>{data.comprador.etiqueta}</h1>
      <p className="centrado">
        {data.comprador.telefono && `Tel. ${data.comprador.telefono} · `}
        {debe ? (
          <>
            Debe <strong className="pendiente">{formatearPesos(data.deuda_total)}</strong> en{' '}
            {data.ventas_impagas} {data.ventas_impagas === 1 ? 'venta' : 'ventas'}. Tocá una venta
            para cobrarla.
          </>
        ) : (
          'No debe nada.'
        )}
      </p>
      <Tabla
        filas={data.ventas}
        vacio="Todavía no compró nada."
        onFila={(v) => navigate(`/ventas/${v.id}`)}
        columnas={[
          { clave: 'id', titulo: 'Venta' },
          { clave: 'fecha', titulo: 'Fecha', render: (v) => formatearFechaHora(v.fecha) },
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
            render: (v) => formatearPesos(v.deuda),
          },
          {
            clave: 'estado_pago',
            titulo: 'Estado',
            render: (v) => <EstadoPago venta={{ ...v, estado: 'activa' }} />,
          },
        ]}
      />
    </section>
  );
}
