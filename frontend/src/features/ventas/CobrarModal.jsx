// 13.4 Cobrar fiado: muestra la deuda y permite pago parcial, total o mixto.
import { useState } from 'react';
import { cobrarVenta } from '../../api/recursos.js';
import { useInvalidar } from '../../hooks/useInvalidar.js';
import { useToast } from '../../components/Toast.jsx';
import { Confirmacion } from '../../components/Modal.jsx';
import { EditorPagos, pagosParaApi, sumaPagos } from './EditorPagos.jsx';
import { aCentavos, formatearPesos } from '../../utils/formato.js';

export function CobrarModal({ venta, onCerrar }) {
  const toast = useToast();
  const invalidar = useInvalidar();
  const deuda = aCentavos(venta.deuda);
  const [pagos, setPagos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const suma = sumaPagos(pagos);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await cobrarVenta(venta.id, pagosParaApi(pagos));
      await invalidar();
      toast.exito(`Cobro de ${formatearPesos(suma, { centavos: true })} registrado.`);
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
      titulo={`Cobrar venta #${venta.id}`}
      textoConfirmar="Registrar cobro"
      cargando={enviando}
      deshabilitado={suma <= 0 || suma > deuda}
      onConfirmar={confirmar}
      onCancelar={onCerrar}
    >
      <p>
        Debe: <strong>{formatearPesos(venta.deuda)}</strong>
      </p>
      <EditorPagos pagos={pagos} onChange={setPagos} objetivo={deuda} etiqueta="Pago" />
      {suma > deuda && <p className="alerta alerta--error">El pago supera la deuda.</p>}
      {suma > 0 && suma < deuda && (
        <p>Va a quedar debiendo {formatearPesos(deuda - suma, { centavos: true })}.</p>
      )}
    </Confirmacion>
  );
}
