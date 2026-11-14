// 13.13 Indicador de saldos (efectivo / transferencia) y deuda con la comisión.
import { useQuery } from '@tanstack/react-query';
import { obtenerSaldos } from '../../api/recursos.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { aCentavos, formatearPesos } from '../../utils/formato.js';

export function useSaldos() {
  const { puede } = useAuth();
  return useQuery({
    queryKey: ['saldos'],
    queryFn: obtenerSaldos,
    enabled: puede('saldos.consultar'),
  });
}

const clase = (monto) => (aCentavos(monto) < 0 ? 'saldo saldo--negativo' : 'saldo');

export function IndicadorSaldos() {
  const { data } = useSaldos();
  if (!data) return null;
  return (
    <div className="saldos" aria-label="Saldos de la tienda">
      <div className={clase(data.efectivo)}>
        <span>Efectivo</span>
        <strong>{formatearPesos(data.efectivo)}</strong>
      </div>
      <div className={clase(data.transferencia)}>
        <span>Transferencia</span>
        <strong>{formatearPesos(data.transferencia)}</strong>
      </div>
      {aCentavos(data.deuda_comision) > 0 && (
        <div className="saldo saldo--deuda">
          <span>Deuda con la comisión</span>
          <strong>{formatearPesos(data.deuda_comision)}</strong>
        </div>
      )}
    </div>
  );
}

/**
 * Aviso previo: si la operación deja negativo algún medio. `cambios` = { efectivo, transferencia }
 * en centavos (lo que suma o resta la operación).
 */
export function AvisoSaldoNegativo({ cambios }) {
  const { data } = useSaldos();
  if (!data) return null;
  const negativos = ['efectivo', 'transferencia'].filter(
    (m) => (cambios[m] ?? 0) < 0 && aCentavos(data[m]) + cambios[m] < 0,
  );
  if (negativos.length === 0) return null;
  return (
    <p className="alerta alerta--aviso">
      Atención: el saldo en {negativos.join(' y ')} va a quedar negativo (
      {negativos
        .map((m) => formatearPesos(aCentavos(data[m]) + cambios[m], { centavos: true }))
        .join(' / ')}
      ). Se puede registrar igual.
    </p>
  );
}
