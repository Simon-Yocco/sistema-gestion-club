// 13.6 Cambio sin venta registrada (prenda comprada antes del sistema). La prenda devuelta
// se valúa al precio actual; la diferencia se cobra o se devuelve en el momento.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cambiarSinVenta } from '../api/recursos.js';
import { useInvalidar } from '../hooks/useInvalidar.js';
import { useToast } from '../components/Toast.jsx';
import { Boton } from '../components/Boton.jsx';
import { Confirmacion } from '../components/Modal.jsx';
import { SelectorPrenda } from '../features/ventas/SelectorPrenda.jsx';
import { SelectorComprador, compradorParaApi } from '../features/ventas/SelectorComprador.jsx';
import { EditorPagos, pagosParaApi, sumaPagos } from '../features/ventas/EditorPagos.jsx';
import { aCentavos, formatearPesos } from '../utils/formato.js';

const pesos = (c) => formatearPesos(c, { centavos: true });
const nombre = (p) => `${p.producto} ${p.color} ${p.talle}`;

export function CambioSinVentaPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const invalidar = useInvalidar();
  const [devuelta, setDevuelta] = useState(null);
  const [nueva, setNueva] = useState(null);
  const [comprador, setComprador] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const diferencia = devuelta && nueva ? aCentavos(nueva.precio) - aCentavos(devuelta.precio) : 0;
  const listo = devuelta && nueva && (diferencia <= 0 || sumaPagos(pagos) === diferencia);

  const confirmar = async () => {
    setEnviando(true);
    try {
      const { venta } = await cambiarSinVenta({
        ...compradorParaApi(comprador),
        variante_devuelta_id: devuelta.variante_id,
        variante_nueva_id: nueva.variante_id,
        ...(diferencia > 0 ? { pagos: pagosParaApi(pagos) } : {}),
      });
      await invalidar();
      toast.exito('Cambio registrado.');
      navigate(`/ventas/${venta.id}`);
    } catch (err) {
      toast.error(err.message);
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  };

  const elegida = (prenda, quitar) => (
    <p>
      <strong>{nombre(prenda)}</strong> — {formatearPesos(prenda.precio)}{' '}
      <Boton variante="texto" onClick={quitar}>
        Cambiar
      </Boton>
    </p>
  );

  return (
    <section>
      <h1>Cambio sin venta registrada</h1>
      <p>Para prendas vendidas antes de usar el sistema o cuya venta no se encuentra.</p>

      <h2>1. Prenda que devuelve</h2>
      {devuelta ? (
        elegida(devuelta, () => setDevuelta(null))
      ) : (
        <SelectorPrenda
          permitirSinStock
          onElegir={setDevuelta}
          etiqueta="Buscar la prenda devuelta"
        />
      )}

      <h2>2. Prenda que se lleva</h2>
      {nueva ? (
        elegida(nueva, () => setNueva(null))
      ) : (
        <SelectorPrenda onElegir={setNueva} etiqueta="Buscar la prenda nueva" />
      )}

      <h2>3. Comprador (opcional)</h2>
      <SelectorComprador valor={comprador} onChange={setComprador} />

      {devuelta && nueva && (
        <div className="panel">
          <p>
            Diferencia: <strong>{pesos(diferencia)}</strong>
          </p>
          {diferencia > 0 && (
            <EditorPagos
              pagos={pagos}
              onChange={setPagos}
              objetivo={diferencia}
              etiqueta="Cobro de la diferencia"
            />
          )}
          {diferencia < 0 && (
            <p className="alerta alerta--aviso">
              Devolver al cliente {pesos(-diferencia)} en efectivo.
            </p>
          )}
          {diferencia === 0 && <p>Mismo valor: no hay movimiento de dinero.</p>}
          <Boton tamano="grande" disabled={!listo} onClick={() => setConfirmando(true)}>
            Revisar y confirmar
          </Boton>
        </div>
      )}

      <Confirmacion
        abierto={confirmando}
        titulo="Confirmar cambio"
        textoConfirmar="Confirmar cambio"
        cargando={enviando}
        onConfirmar={confirmar}
        onCancelar={() => setConfirmando(false)}
      >
        {devuelta && nueva && (
          <p>
            Vuelve al stock: {nombre(devuelta)}. Se lleva: {nombre(nueva)}. Diferencia:{' '}
            {pesos(diferencia)}.
          </p>
        )}
      </Confirmacion>
    </section>
  );
}
