// Reintegro de dinero al cliente (devolución, anulación o cambio a favor del cliente).
// Por defecto se devuelve en efectivo, pero se puede elegir transferencia o mixto (por
// ejemplo, si no hay efectivo en la caja).
import { EditorPagos, sumaPagos } from './EditorPagos.jsx';
import { formatearPesos } from '../../utils/formato.js';

const pesos = (c) => formatearPesos(c, { centavos: true });

/** `monto` en centavos; `valor` / `onChange`: lista de { medio, monto } como EditorPagos. */
export function ElegirReintegro({ monto, valor, onChange }) {
  if (!(monto > 0)) return null;
  const suma = sumaPagos(valor);
  return (
    <div className="alerta alerta--aviso">
      <EditorPagos
        pagos={valor}
        onChange={onChange}
        objetivo={monto}
        etiqueta={`Devolver al cliente: ${pesos(monto)}`}
        modoInicial="efectivo"
      />
      {valor.length > 0 && suma !== monto && (
        <p className="alerta alerta--error">
          Lo que se devuelve tiene que sumar {pesos(monto)} (ahora suma {pesos(suma)}).
        </p>
      )}
    </div>
  );
}

/** Si hay que devolver, que lo elegido sume exactamente el monto. */
export const reintegroListo = (monto, valor) => !(monto > 0) || sumaPagos(valor) === monto;
