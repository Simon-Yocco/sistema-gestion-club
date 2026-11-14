// 13.3 Detalle de venta con acciones según el estado: Cobrar, Cambiar prenda, Devolver, Anular.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { obtenerVenta } from '../api/recursos.js';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { Boton } from '../components/Boton.jsx';
import { Cargando } from '../components/Cargando.jsx';
import { Tabla } from '../components/Tabla.jsx';
import { EstadoPago } from '../features/ventas/EstadoPago.jsx';
import { CobrarModal } from '../features/ventas/CobrarModal.jsx';
import { CambiarModal } from '../features/ventas/CambiarModal.jsx';
import { DevolverModal } from '../features/ventas/DevolverModal.jsx';
import { AnularModal } from '../features/ventas/AnularModal.jsx';
import { formatearFechaHora, formatearPesos } from '../utils/formato.js';

const MEDIO = { efectivo: 'Efectivo', transferencia: 'Transferencia' };
const TIPO_PAGO = { cobro: 'Cobro', devolucion: 'Reintegro', credito_cambio: 'Crédito por cambio' };
const RESOLUCION = {
  sin_diferencia: 'Sin diferencia',
  cobro: 'Se cobró la diferencia',
  devolucion: 'Se devolvió la diferencia',
  ajuste_deuda: 'Ajustó la deuda',
};

export function DetalleVentaPage() {
  const { id } = useParams();
  const { puede } = useAuth();
  const [accion, setAccion] = useState(null);
  const { data, isPending, error } = useQuery({
    queryKey: ['venta', id],
    queryFn: () => obtenerVenta(id),
  });

  if (isPending) return <Cargando />;
  if (error) return <p className="alerta alerta--error">{error.message}</p>;
  const v = data.venta;
  const activa = v.estado === 'activa';
  const conPrendas = v.items.some((i) => i.cantidad_vigente > 0);
  const cerrar = () => setAccion(null);

  return (
    <section>
      <p>
        <Link to="/ventas">← Ventas</Link>
      </p>
      <h1>
        Venta #{v.id} <EstadoPago venta={v} />
      </h1>
      <p>
        {formatearFechaHora(v.fecha)} · Atendió {v.usuario.nombre}
        {v.comprador && (
          <>
            {' '}
            · Comprador: <strong>{v.comprador.etiqueta}</strong>
            {v.comprador.telefono && ` (${v.comprador.telefono})`}
          </>
        )}
      </p>
      {!activa && (
        <p className="alerta alerta--error">
          Anulada el {formatearFechaHora(v.anulada_at)} por {v.anulada_por?.nombre}:{' '}
          {v.motivo_anulacion}
        </p>
      )}

      <dl className="totales totales--linea">
        <dt>Total</dt>
        <dd>{formatearPesos(v.total)}</dd>
        <dt>Pagado</dt>
        <dd>{formatearPesos(v.pagado)}</dd>
        <dt>Debe</dt>
        <dd className={Number(v.deuda) > 0 ? 'pendiente' : undefined}>{formatearPesos(v.deuda)}</dd>
      </dl>

      {activa && (
        <div className="acciones">
          {Number(v.deuda) > 0 && puede('ventas.cobrar') && (
            <Boton onClick={() => setAccion('cobrar')}>Cobrar</Boton>
          )}
          {conPrendas && puede('cambios.registrar') && (
            <Boton variante="secundario" onClick={() => setAccion('cambiar')}>
              Cambiar prenda
            </Boton>
          )}
          {conPrendas && puede('devoluciones.registrar') && (
            <Boton variante="secundario" onClick={() => setAccion('devolver')}>
              Devolver
            </Boton>
          )}
          {puede('devoluciones.registrar') && (
            <Boton variante="peligro" onClick={() => setAccion('anular')}>
              Anular venta
            </Boton>
          )}
        </div>
      )}

      <h2>Prendas</h2>
      <Tabla
        filas={v.items}
        columnas={[
          {
            clave: 'producto',
            titulo: 'Prenda',
            render: (i) =>
              `${i.producto} ${i.color} ${i.talle}${i.origen === 'cambio' ? ' (por cambio)' : ''}`,
          },
          { clave: 'cantidad', titulo: 'Cant.', alinear: 'derecha' },
          {
            clave: 'cantidad_devuelta',
            titulo: 'Devueltas',
            alinear: 'derecha',
            render: (i) => i.cantidad_devuelta || '',
          },
          {
            clave: 'precio_unitario',
            titulo: 'Precio',
            alinear: 'derecha',
            render: (i) => formatearPesos(i.precio_unitario),
          },
          {
            clave: 'subtotal',
            titulo: 'Subtotal',
            alinear: 'derecha',
            render: (i) => formatearPesos(i.subtotal),
          },
        ]}
      />

      <h2>Pagos</h2>
      <Tabla
        filas={v.pagos}
        vacio="Sin pagos (fiado)."
        columnas={[
          { clave: 'fecha', titulo: 'Fecha', render: (p) => formatearFechaHora(p.fecha) },
          { clave: 'tipo', titulo: 'Tipo', render: (p) => TIPO_PAGO[p.tipo] },
          { clave: 'medio', titulo: 'Medio', render: (p) => MEDIO[p.medio] ?? '—' },
          {
            clave: 'monto',
            titulo: 'Monto',
            alinear: 'derecha',
            render: (p) => formatearPesos(p.monto),
          },
          { clave: 'usuario', titulo: 'Usuario', render: (p) => p.usuario?.nombre },
        ]}
      />

      {v.cambios.length > 0 && (
        <>
          <h2>Cambios</h2>
          <Tabla
            filas={v.cambios}
            columnas={[
              { clave: 'fecha', titulo: 'Fecha', render: (c) => formatearFechaHora(c.fecha) },
              {
                clave: 'devuelta',
                titulo: 'Devolvió',
                render: (c) =>
                  `${c.devuelta.cantidad} × ${c.devuelta.producto} ${c.devuelta.color} ${c.devuelta.talle}`,
              },
              {
                clave: 'nueva',
                titulo: 'Se llevó',
                render: (c) =>
                  `${c.nueva.cantidad} × ${c.nueva.producto} ${c.nueva.color} ${c.nueva.talle}`,
              },
              {
                clave: 'diferencia',
                titulo: 'Diferencia',
                alinear: 'derecha',
                render: (c) => formatearPesos(c.diferencia),
              },
              {
                clave: 'resolucion',
                titulo: 'Resolución',
                render: (c) => RESOLUCION[c.resolucion],
              },
            ]}
          />
        </>
      )}

      {v.devoluciones.length > 0 && (
        <>
          <h2>Devoluciones y anulación</h2>
          <Tabla
            filas={v.devoluciones}
            columnas={[
              { clave: 'fecha', titulo: 'Fecha', render: (d) => formatearFechaHora(d.fecha) },
              {
                clave: 'tipo',
                titulo: 'Tipo',
                render: (d) => (d.tipo === 'anulacion' ? 'Anulación' : 'Devolución'),
              },
              { clave: 'motivo', titulo: 'Motivo' },
              { clave: 'usuario', titulo: 'Usuario', render: (d) => d.usuario?.nombre },
            ]}
          />
        </>
      )}

      {accion === 'cobrar' && <CobrarModal venta={v} onCerrar={cerrar} />}
      {accion === 'cambiar' && <CambiarModal venta={v} onCerrar={cerrar} />}
      {accion === 'devolver' && <DevolverModal venta={v} onCerrar={cerrar} />}
      {accion === 'anular' && <AnularModal venta={v} onCerrar={cerrar} />}
    </section>
  );
}
