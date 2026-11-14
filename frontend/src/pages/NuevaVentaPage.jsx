// 13.1 Nueva venta. Flujo rápido: tocar la prenda en la grilla → "Todo en efectivo" →
// "Revisar y confirmar" → "Confirmar venta". Totales siempre visibles.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { crearVenta } from '../api/recursos.js';
import { useInvalidar } from '../hooks/useInvalidar.js';
import { useToast } from '../components/Toast.jsx';
import { Boton } from '../components/Boton.jsx';
import { Confirmacion } from '../components/Modal.jsx';
import { SelectorPrenda } from '../features/ventas/SelectorPrenda.jsx';
import {
  SelectorComprador,
  compradorParaApi,
  puedeFiar,
} from '../features/ventas/SelectorComprador.jsx';
import { EditorPagos, pagosParaApi, sumaPagos } from '../features/ventas/EditorPagos.jsx';
import { aCentavos, formatearPesos } from '../utils/formato.js';

const pesos = (c) => formatearPesos(c, { centavos: true });

export function NuevaVentaPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const invalidar = useInvalidar();
  const [carrito, setCarrito] = useState([]);
  const [comprador, setComprador] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const total = carrito.reduce((a, i) => a + aCentavos(i.precio) * i.cantidad, 0);
  const pagado = sumaPagos(pagos);
  const pendiente = total - pagado;
  const faltaComprador = pendiente > 0 && !puedeFiar(comprador);
  const compradorNuevoSinNombre = comprador?.nuevo && !comprador.nombre.trim();

  let problema = null;
  if (carrito.length === 0) problema = 'Agregá al menos una prenda.';
  else if (pagado > total) problema = 'Los pagos superan el total.';
  else if (faltaComprador)
    problema = 'Queda saldo pendiente (fiado): elegí el comprador con su teléfono.';
  else if (compradorNuevoSinNombre) problema = 'Completá el nombre del comprador.';

  const agregar = (prenda) =>
    setCarrito((c) => {
      const existente = c.find((i) => i.variante_id === prenda.variante_id);
      if (existente) {
        if (existente.cantidad >= prenda.stock) {
          toast.aviso(`No hay más stock de ${prenda.producto} ${prenda.color} ${prenda.talle}.`);
          return c;
        }
        return c.map((i) => (i === existente ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [...c, { ...prenda, cantidad: 1 }];
    });

  const cambiarCantidad = (variante, cantidad) =>
    setCarrito((c) =>
      cantidad <= 0
        ? c.filter((i) => i.variante_id !== variante)
        : c.map((i) =>
            i.variante_id === variante ? { ...i, cantidad: Math.min(cantidad, i.stock) } : i,
          ),
    );

  const confirmar = async () => {
    setEnviando(true);
    try {
      const { venta } = await crearVenta({
        ...compradorParaApi(comprador),
        items: carrito.map((i) => ({ variante_id: i.variante_id, cantidad: i.cantidad })),
        pagos: pagosParaApi(pagos),
      });
      await invalidar();
      toast.exito(`Venta #${venta.id} registrada.`);
      navigate(`/ventas/${venta.id}`);
    } catch (err) {
      toast.error(err.message);
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="nueva-venta">
      <h1>Nueva venta</h1>
      <div className="nueva-venta__columnas">
        <div>
          <SelectorPrenda onElegir={agregar} />
        </div>

        <aside className="panel">
          <h2>Carrito</h2>
          {carrito.length === 0 ? (
            <p className="tabla__vacia">Tocá un talle en la grilla para agregarlo.</p>
          ) : (
            <ul className="carrito">
              {carrito.map((i) => (
                <li key={i.variante_id}>
                  <span>
                    {i.producto} {i.color} {i.talle}
                    <small> · {formatearPesos(i.precio)}</small>
                  </span>
                  <span className="carrito__cantidad">
                    <Boton
                      variante="secundario"
                      aria-label="Uno menos"
                      onClick={() => cambiarCantidad(i.variante_id, i.cantidad - 1)}
                    >
                      −
                    </Boton>
                    <strong>{i.cantidad}</strong>
                    <Boton
                      variante="secundario"
                      aria-label="Uno más"
                      disabled={i.cantidad >= i.stock}
                      onClick={() => cambiarCantidad(i.variante_id, i.cantidad + 1)}
                    >
                      +
                    </Boton>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <SelectorComprador valor={comprador} onChange={setComprador} />
          <EditorPagos pagos={pagos} onChange={setPagos} objetivo={total} />

          <dl className="totales">
            <dt>Total</dt>
            <dd>{pesos(total)}</dd>
            <dt>Pagado</dt>
            <dd>{pesos(pagado)}</dd>
            <dt>Pendiente</dt>
            <dd className={pendiente > 0 ? 'pendiente' : undefined}>
              {pesos(Math.max(0, pendiente))}
            </dd>
          </dl>
          {problema && carrito.length > 0 && <p className="alerta alerta--aviso">{problema}</p>}
          <Boton tamano="grande" disabled={Boolean(problema)} onClick={() => setConfirmando(true)}>
            Revisar y confirmar
          </Boton>
        </aside>
      </div>

      <Confirmacion
        abierto={confirmando}
        titulo="Confirmar venta"
        textoConfirmar="Confirmar venta"
        cargando={enviando}
        onConfirmar={confirmar}
        onCancelar={() => setConfirmando(false)}
      >
        <ul>
          {carrito.map((i) => (
            <li key={i.variante_id}>
              {i.cantidad} × {i.producto} {i.color} {i.talle} —{' '}
              {pesos(aCentavos(i.precio) * i.cantidad)}
            </li>
          ))}
        </ul>
        <p>
          <strong>Total: {pesos(total)}</strong>
        </p>
        {pagos
          .filter((p) => p.monto > 0)
          .map((p, i) => (
            <p key={i}>
              {p.medio === 'efectivo' ? 'Efectivo' : 'Transferencia'}: {pesos(p.monto)}
            </p>
          ))}
        {pendiente > 0 && (
          <p className="alerta alerta--aviso">
            Queda fiado: {pesos(pendiente)} a nombre de{' '}
            {comprador?.nuevo ? comprador.nombre : comprador?.etiqueta}.
          </p>
        )}
        {comprador && pendiente <= 0 && (
          <p>Comprador: {comprador.nuevo ? comprador.nombre : comprador.etiqueta}</p>
        )}
      </Confirmacion>
    </section>
  );
}
