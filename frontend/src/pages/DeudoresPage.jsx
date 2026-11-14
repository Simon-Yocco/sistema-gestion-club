// 13.9 Deudores: monto y antigüedad, acceso a la cuenta del comprador para cobrar.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cuentaComprador, listarDeudores } from '../api/recursos.js';
import { Tabla } from '../components/Tabla.jsx';
import { Select } from '../components/Campo.jsx';
import { Cargando } from '../components/Cargando.jsx';
import { EstadoPago } from '../features/ventas/EstadoPago.jsx';
import { formatearFechaHora, formatearPesos } from '../utils/formato.js';

const dias = (n) => (n === 0 ? 'hoy' : n === 1 ? '1 día' : `${n} días`);

export function DeudoresPage() {
  const navigate = useNavigate();
  const [orden, setOrden] = useState('antiguedad');
  const { data, isPending, error } = useQuery({
    queryKey: ['deudores', orden],
    queryFn: () => listarDeudores(orden),
  });

  return (
    <section>
      <h1>Deudores</h1>
      <div className="filtros">
        <Select
          etiqueta="Ordenar por"
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          opciones={[
            { valor: 'antiguedad', texto: 'Deuda más vieja' },
            { valor: 'monto', texto: 'El que más debe' },
          ]}
        />
      </div>
      {error && <p className="alerta alerta--error">{error.message}</p>}
      {isPending ? (
        <Cargando />
      ) : (
        <>
          <p>
            Total adeudado: <strong>{formatearPesos(data.total_adeudado)}</strong> ({data.cantidad}{' '}
            {data.cantidad === 1 ? 'persona' : 'personas'})
          </p>
          <Tabla
            filas={data.deudores.map((d) => ({ ...d, id: d.comprador.id }))}
            vacio="Nadie debe nada."
            onFila={(d) => navigate(`/deudores/${d.comprador.id}`)}
            columnas={[
              { clave: 'comprador', titulo: 'Comprador', render: (d) => d.comprador.etiqueta },
              { clave: 'telefono', titulo: 'Teléfono', render: (d) => d.comprador.telefono },
              {
                clave: 'deuda',
                titulo: 'Debe',
                alinear: 'derecha',
                render: (d) => formatearPesos(d.deuda),
              },
              { clave: 'ventas_impagas', titulo: 'Ventas', alinear: 'derecha' },
              {
                clave: 'antiguedad_dias',
                titulo: 'Debe desde hace',
                render: (d) => dias(d.antiguedad_dias),
              },
            ]}
          />
        </>
      )}
    </section>
  );
}

/** Cuenta de un comprador: sus ventas con deuda, para ir a cobrar cada una. */
export function CuentaCompradorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isPending, error } = useQuery({
    queryKey: ['cuenta', id],
    queryFn: () => cuentaComprador(id),
  });
  if (isPending) return <Cargando />;
  if (error) return <p className="alerta alerta--error">{error.message}</p>;

  return (
    <section>
      <p>
        <Link to="/deudores">← Deudores</Link>
      </p>
      <h1>{data.comprador.etiqueta}</h1>
      <p>
        {data.comprador.telefono && `Tel. ${data.comprador.telefono} · `}
        Debe <strong>{formatearPesos(data.deuda_total)}</strong> en {data.ventas_impagas}{' '}
        {data.ventas_impagas === 1 ? 'venta' : 'ventas'}. Tocá una venta para cobrarla.
      </p>
      <Tabla
        filas={data.ventas}
        vacio="No tiene ventas."
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
