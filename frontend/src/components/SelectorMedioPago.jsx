const MEDIOS = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transferencia' },
];

/** Dos botones grandes para elegir el medio de pago (más rápido que un select). */
export function SelectorMedioPago({ valor, onChange, etiqueta = 'Medio de pago', disabled }) {
  return (
    <fieldset className="selector-medio" disabled={disabled}>
      <legend className="campo__etiqueta">{etiqueta}</legend>
      <div className="selector-medio__opciones" role="radiogroup" aria-label={etiqueta}>
        {MEDIOS.map((m) => (
          <button
            key={m.valor}
            type="button"
            role="radio"
            aria-checked={valor === m.valor}
            className={`selector-medio__opcion ${valor === m.valor ? 'selector-medio__opcion--activa' : ''}`}
            onClick={() => onChange(m.valor)}
          >
            {m.texto}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
