// 13.5 Cambiar prenda: elegir la prenda que devuelve → elegir la nueva → el sistema muestra
// la diferencia y qué hacer (cobrar / devolver / ajusta la deuda) → confirmar.
import { useEffect, useState } from 'react';
import { cambiar, previsualizarCambio } from '../../api/recursos.js';
import { useInvalidar } from '../../hooks/useInvalidar.js';
import { useToast } from '../../components/Toast.jsx';
import { Modal } from '../../components/Modal.jsx';
import { Boton } from '../../components/Boton.jsx';
import { SelectorPrenda } from './SelectorPrenda.jsx';
import { EditorPagos, pagosParaApi, sumaPagos } from './EditorPagos.jsx';
import { ReintegroPropuesto } from './ResumenDinero.jsx';
import { aCentavos, formatearPesos } from '../../utils/formato.js';

const QUE_HACER = {
  sin_diferencia: 'Mismo valor: no hay movimiento de dinero.',
  cobro: 'La prenda nueva es más cara: cobrar la diferencia.',
  devolucion: 'Hay que devolver dinero al cliente.',
  ajuste_deuda: 'La venta tiene deuda: la diferencia ajusta lo que debe.',
};

export function CambiarModal({ venta, onCerrar }) {
  const toast = useToast();
  const invalidar = useInvalidar();
  const items = venta.items.filter((i) => i.cantidad_vigente > 0);
  const [itemId, setItemId] = useState(items.length === 1 ? items[0].id : null);
  const [nueva, setNueva] = useState(null);
  const [calculo, setCalculo] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setCalculo(null);
    if (!itemId || !nueva) return;
    previsualizarCambio(venta.id, { venta_item_id: itemId, variante_nueva_id: nueva.variante_id })
      .then(setCalculo)
      .catch((err) => toast.error(err.message));
  }, [itemId, nueva, venta.id, toast]);

  const aCobrar = calculo ? aCentavos(calculo.a_cobrar) : 0;
  const listo = calculo && (aCobrar === 0 || sumaPagos(pagos) === aCobrar);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await cambiar(venta.id, {
        venta_item_id: itemId,
        variante_nueva_id: nueva.variante_id,
        ...(aCobrar > 0 ? { pagos: pagosParaApi(pagos) } : {}),
      });
      await invalidar();
      toast.exito('Cambio registrado.');
      onCerrar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      abierto
      ancho="ancho"
      titulo={`Cambiar prenda · venta #${venta.id}`}
      onCerrar={enviando ? undefined : onCerrar}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton onClick={confirmar} disabled={!listo} cargando={enviando}>
            Confirmar cambio
          </Boton>
        </>
      }
    >
      <h3>1. ¿Qué prenda devuelve?</h3>
      <div className="opciones">
        {items.map((i) => (
          <label key={i.id} className="opcion">
            <input
              type="radio"
              name="item"
              checked={itemId === i.id}
              onChange={() => setItemId(i.id)}
            />
            {i.producto} {i.color} {i.talle} — {formatearPesos(i.precio_unitario)}
          </label>
        ))}
      </div>

      <h3>2. ¿Qué prenda se lleva?</h3>
      {nueva ? (
        <p>
          <strong>
            {nueva.producto} {nueva.color} {nueva.talle}
          </strong>{' '}
          — {formatearPesos(nueva.precio)}{' '}
          <Boton variante="texto" onClick={() => setNueva(null)}>
            Cambiar
          </Boton>
        </p>
      ) : (
        <SelectorPrenda onElegir={setNueva} />
      )}

      {calculo && (
        <>
          <h3>3. Diferencia</h3>
          <p>
            Devuelve {formatearPesos(calculo.valor_devuelto)} · Se lleva{' '}
            {formatearPesos(calculo.valor_nuevo)} · Diferencia{' '}
            <strong>{formatearPesos(calculo.diferencia)}</strong>
          </p>
          <p className="alerta alerta--exito">{QUE_HACER[calculo.resolucion]}</p>
          {calculo.resolucion === 'ajuste_deuda' && (
            <p>Va a deber {formatearPesos(calculo.deuda_resultante)}.</p>
          )}
          {aCobrar > 0 && (
            <EditorPagos
              pagos={pagos}
              onChange={setPagos}
              objetivo={aCobrar}
              etiqueta="Cobro de la diferencia"
            />
          )}
          <ReintegroPropuesto reintegro={calculo.reintegro} />
        </>
      )}
    </Modal>
  );
}
