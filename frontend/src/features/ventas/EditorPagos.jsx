// Uno o varios pagos (pago mixto). Montos en centavos. `objetivo` es lo que hay que cobrar:
// los botones "Todo en efectivo / Todo con transferencia" lo completan en un clic.
import { InputDinero } from '../../components/InputDinero.jsx';
import { Boton } from '../../components/Boton.jsx';
import { desdeCentavos, formatearPesos } from '../../utils/formato.js';

export const sumaPagos = (pagos) => pagos.reduce((a, p) => a + (p.monto ?? 0), 0);
export const pagosParaApi = (pagos) =>
  pagos.filter((p) => p.monto > 0).map((p) => ({ medio: p.medio, monto: desdeCentavos(p.monto) }));

export function EditorPagos({ pagos, onChange, objetivo, etiqueta = 'Pagos' }) {
  const actualizar = (i, cambios) =>
    onChange(pagos.map((p, j) => (j === i ? { ...p, ...cambios } : p)));
  const todoEn = (medio) => onChange([{ medio, monto: objetivo }]);

  return (
    <fieldset className="editor-pagos">
      <legend className="campo__etiqueta">{etiqueta}</legend>
      <div className="editor-pagos__rapidos">
        <Boton variante="secundario" onClick={() => todoEn('efectivo')} disabled={objetivo <= 0}>
          Todo en efectivo
        </Boton>
        <Boton
          variante="secundario"
          onClick={() => todoEn('transferencia')}
          disabled={objetivo <= 0}
        >
          Todo con transferencia
        </Boton>
      </div>
      {pagos.map((p, i) => (
        <div className="editor-pagos__fila" key={i}>
          <select
            className="input"
            aria-label={`Medio del pago ${i + 1}`}
            value={p.medio}
            onChange={(e) => actualizar(i, { medio: e.target.value })}
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
          <InputDinero
            etiqueta={`Monto del pago ${i + 1}`}
            valor={p.monto}
            onChange={(monto) => actualizar(i, { monto })}
          />
          <Boton
            variante="texto"
            aria-label={`Quitar pago ${i + 1}`}
            onClick={() => onChange(pagos.filter((_, j) => j !== i))}
          >
            ✕
          </Boton>
        </div>
      ))}
      <Boton
        variante="texto"
        onClick={() => onChange([...pagos, { medio: 'efectivo', monto: null }])}
      >
        + Agregar pago
      </Boton>
      {pagos.length > 0 && (
        <p>Suma de pagos: {formatearPesos(sumaPagos(pagos), { centavos: true })}</p>
      )}
    </fieldset>
  );
}
