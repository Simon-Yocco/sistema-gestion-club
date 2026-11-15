// 13.3 Detalle de venta con forma de comprobante (fecha y comprador arriba, prendas en el
// medio, total abajo) y acciones según el estado: Cobrar, Cambiar prenda, Devolver, Anular.
import { Fragment, useState } from 'react';
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
import { aCentavos, formatearFechaHora, formatearPesos, partesFecha } from '../utils/formato.js';

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
  const cuando = partesFecha(v.fecha);
  // Neto pagado por medio (cobros − reintegros), en centavos, para el pie del comprobante.
  const porMedio = {};
  for (const p of v.pagos) {
    const clave = p.medio ? `Pagó en ${MEDIO[p.medio].toLowerCase()}` : 'Crédito por cambio';
    porMedio[clave] = (porMedio[clave] ?? 0) + aCentavos(p.monto);
  }
  const resumenPagos = Object.entries(porMedio).filter(([, monto]) => monto !== 0);

  return (
    <section>
      <p className="no-imprimir">
        <Link to="/ventas">← Ventas</Link>
      </p>
      <div className="acciones acciones--pantalla">
        {activa && Number(v.deuda) > 0 && puede('ventas.cobrar') && (
          <Boton onClick={() => setAccion('cobrar')}>Cobrar</Boton>
        )}
        {activa && conPrendas && puede('cambios.registrar') && (
          <Boton variante="secundario" onClick={() => setAccion('cambiar')}>
            Cambiar prenda
          </Boton>
        )}
        {activa && conPrendas && puede('devoluciones.registrar') && (
          <Boton variante="secundario" onClick={() => setAccion('devolver')}>
            Devolver
          </Boton>
        )}
        <Boton variante="secundario" onClick={() => window.print()}>
          Imprimir
        </Boton>
        {activa && puede('devoluciones.registrar') && (
          <Boton variante="peligro" onClick={() => setAccion('anular')}>
            Anular venta
          </Boton>
        )}
      </div>

      <article className="comprobante" aria-label="Comprobante de venta">
        <header className="comprobante__encabezado">
          <div>
            <p className="comprobante__tienda">Tienda del club</p>
            <h1>
              Venta #{v.id} <EstadoPago venta={v} />
            </h1>
          </div>
          <dl className="comprobante__datos">
            <dt>Día</dt>
            <dd>{cuando.dia}</dd>
            <dt>Fecha</dt>
            <dd>{cuando.fecha}</dd>
            <dt>Hora</dt>
            <dd>{cuando.hora}</dd>
          </dl>
        </header>

        <dl className="comprobante__datos comprobante__comprador">
          <dt>Comprador</dt>
          <dd>{v.comprador ? v.comprador.nombre : 'Sin datos (consumidor final)'}</dd>
          {v.comprador?.apodo && (
            <>
              <dt>Apodo</dt>
              <dd>{v.comprador.apodo}</dd>
            </>
          )}
          {v.comprador?.telefono && (
            <>
              <dt>Teléfono</dt>
              <dd>{v.comprador.telefono}</dd>
            </>
          )}
          <dt>Atendió</dt>
          <dd>{v.usuario.nombre}</dd>
        </dl>

        {!activa && (
          <p className="alerta alerta--error">
            Anulada el {formatearFechaHora(v.anulada_at)} por {v.anulada_por?.nombre}:{' '}
            {v.motivo_anulacion}
          </p>
        )}

        <table className="comprobante__items">
          <thead>
            <tr>
              <th className="derecha">Cant.</th>
              <th>Producto</th>
              <th>Color</th>
              <th>Talle</th>
              <th className="derecha">P. unitario</th>
              <th className="derecha">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {v.items.map((i) => (
              <tr key={i.id} className={i.cantidad_vigente === 0 ? 'comprobante__anulado' : ''}>
                <td className="derecha">
                  {i.cantidad_vigente}
                  {i.cantidad_devuelta > 0 && (
                    <small className="comprobante__nota"> ({i.cantidad_devuelta} devuelta)</small>
                  )}
                </td>
                <td>
                  {i.producto}
                  {i.origen === 'cambio' && (
                    <small className="comprobante__nota"> (por cambio)</small>
                  )}
                </td>
                <td>{i.color}</td>
                <td>{i.talle}</td>
                <td className="derecha">{formatearPesos(i.precio_unitario)}</td>
                <td className="derecha">{formatearPesos(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="totales comprobante__totales">
          <dt className="comprobante__total">Total</dt>
          <dd className="comprobante__total">{formatearPesos(v.total)}</dd>
          {resumenPagos.map(([medio, monto]) => (
            <Fragment key={medio}>
              <dt>{medio}</dt>
              <dd>{formatearPesos(monto, { centavos: true })}</dd>
            </Fragment>
          ))}
          {Number(v.deuda) > 0 && (
            <>
              <dt>Debe</dt>
              <dd className="pendiente">{formatearPesos(v.deuda)}</dd>
            </>
          )}
        </dl>
      </article>

      <h2>Historial de pagos</h2>
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
