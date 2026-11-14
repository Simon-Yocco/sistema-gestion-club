import { formatearPesos } from '../../utils/formato.js';

const MEDIO = { efectivo: 'efectivo', transferencia: 'transferencia' };

/** Muestra cuánto dinero hay que devolver y en qué medio (propuesta del backend). */
export function ReintegroPropuesto({ reintegro }) {
  if (!reintegro || reintegro.length === 0) return null;
  return (
    <div className="alerta alerta--aviso">
      <strong>Devolver al cliente:</strong>
      <ul>
        {reintegro.map((r) => (
          <li key={r.medio}>
            {formatearPesos(r.monto)} en {MEDIO[r.medio]}
          </li>
        ))}
      </ul>
    </div>
  );
}
