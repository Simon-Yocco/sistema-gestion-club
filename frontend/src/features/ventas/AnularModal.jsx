// 13.8 Anular: confirmación fuerte (hay que escribir el motivo) y se muestra lo que se va a
// devolver antes de confirmar.
import { useEffect, useState } from 'react';
import { anular, previsualizarAnulacion } from '../../api/recursos.js';
import { useInvalidar } from '../../hooks/useInvalidar.js';
import { useToast } from '../../components/Toast.jsx';
import { Confirmacion } from '../../components/Modal.jsx';
import { Input } from '../../components/Campo.jsx';
import { ElegirReintegro, reintegroListo } from './ResumenDinero.jsx';
import { pagosParaApi } from './EditorPagos.jsx';
import { aCentavos, formatearPesos } from '../../utils/formato.js';

export function AnularModal({ venta, onCerrar }) {
  const toast = useToast();
  const invalidar = useInvalidar();
  const [motivo, setMotivo] = useState('');
  const [calculo, setCalculo] = useState(null);
  const [reintegro, setReintegro] = useState([]);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    previsualizarAnulacion(venta.id)
      .then(setCalculo)
      .catch((err) => toast.error(err.message));
  }, [venta.id, toast]);

  const aReintegrar = calculo ? aCentavos(calculo.a_reintegrar) : 0;

  const confirmar = async () => {
    setEnviando(true);
    try {
      await anular(venta.id, {
        motivo: motivo.trim(),
        ...(aReintegrar > 0 ? { reintegro: pagosParaApi(reintegro) } : {}),
      });
      await invalidar();
      toast.exito(`Venta #${venta.id} anulada.`);
      onCerrar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Confirmacion
      abierto
      titulo={`Anular venta #${venta.id}`}
      textoConfirmar="Anular venta"
      peligro
      cargando={enviando}
      deshabilitado={
        !calculo || motivo.trim().length < 3 || !reintegroListo(aReintegrar, reintegro)
      }
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <p className="alerta alerta--error">
        Se anula la venta completa: vuelven todas las prendas al stock
        {calculo && Number(calculo.a_reintegrar) > 0
          ? ` y se devuelven ${formatearPesos(calculo.a_reintegrar)}.`
          : ' y se cancela la deuda.'}{' '}
        No se puede deshacer.
      </p>
      {calculo && <ElegirReintegro monto={aReintegrar} valor={reintegro} onChange={setReintegro} />}
      <Input
        etiqueta="Motivo de la anulación (obligatorio)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
    </Confirmacion>
  );
}
