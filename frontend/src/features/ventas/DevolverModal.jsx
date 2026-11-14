// 13.7 Devolver: elegir prendas y cantidades, motivo obligatorio, y ver cuánto se devuelve
// y en qué medio antes de confirmar.
import { useEffect, useState } from 'react';
import { devolver, previsualizarDevolucion } from '../../api/recursos.js';
import { useInvalidar } from '../../hooks/useInvalidar.js';
import { useToast } from '../../components/Toast.jsx';
import { Confirmacion } from '../../components/Modal.jsx';
import { Input } from '../../components/Campo.jsx';
import { ReintegroPropuesto } from './ResumenDinero.jsx';
import { formatearPesos } from '../../utils/formato.js';

export function DevolverModal({ venta, onCerrar }) {
  const toast = useToast();
  const invalidar = useInvalidar();
  const items = venta.items.filter((i) => i.cantidad_vigente > 0);
  const [cantidades, setCantidades] = useState({});
  const [motivo, setMotivo] = useState('');
  const [calculo, setCalculo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const elegidos = Object.entries(cantidades)
    .filter(([, c]) => c > 0)
    .map(([id, cantidad]) => ({ venta_item_id: Number(id), cantidad }));
  const clave = JSON.stringify(elegidos);

  useEffect(() => {
    setCalculo(null);
    const lista = JSON.parse(clave);
    if (lista.length === 0) return;
    previsualizarDevolucion(venta.id, lista)
      .then(setCalculo)
      .catch((err) => toast.error(err.message));
  }, [clave, venta.id, toast]);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await devolver(venta.id, { items: elegidos, motivo: motivo.trim() });
      await invalidar();
      toast.exito('Devolución registrada.');
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
      titulo={`Devolver prendas · venta #${venta.id}`}
      textoConfirmar="Registrar devolución"
      peligro
      cargando={enviando}
      deshabilitado={!calculo || motivo.trim().length < 3}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      {items.map((i) => (
        <div key={i.id} className="fila-cantidad">
          <span>
            {i.producto} {i.color} {i.talle} ({formatearPesos(i.precio_unitario)})
          </span>
          <select
            className="input"
            aria-label={`Cantidad a devolver de ${i.producto} ${i.color} ${i.talle}`}
            value={cantidades[i.id] ?? 0}
            onChange={(e) => setCantidades((c) => ({ ...c, [i.id]: Number(e.target.value) }))}
          >
            {Array.from({ length: i.cantidad_vigente + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      ))}
      <Input
        etiqueta="Motivo (obligatorio)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      {calculo && (
        <>
          <p>
            Nuevo total: {formatearPesos(calculo.total_nuevo)}
            {Number(calculo.deuda_resultante) > 0 &&
              ` · Va a deber ${formatearPesos(calculo.deuda_resultante)}`}
          </p>
          {Number(calculo.a_reintegrar) === 0 && <p>No hay dinero para devolver.</p>}
          <ReintegroPropuesto reintegro={calculo.reintegro} />
        </>
      )}
    </Confirmacion>
  );
}
