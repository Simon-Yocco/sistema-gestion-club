import { useState } from 'react';
import { Campo } from './Campo.jsx';
import { aCentavos, formatearPesos } from '../utils/formato.js';

const mostrar = (cents) =>
  cents === null || cents === undefined
    ? ''
    : formatearPesos(cents, { centavos: true }).replace('$ ', '');

/**
 * Input de dinero en formato argentino ("15.000,50").
 * `valor` y `onChange` trabajan en CENTAVOS (número entero, o null si está vacío).
 * Mientras se escribe se respeta el texto; al salir del campo se formatea.
 */
export function InputDinero({ etiqueta, valor, onChange, error, ayuda, ...props }) {
  const [texto, setTexto] = useState(() => mostrar(valor));
  const [editando, setEditando] = useState(false);
  const [invalido, setInvalido] = useState(false);

  // Si el valor cambia desde afuera (por ej. botón "pagar todo"), se muestra formateado.
  const visible = editando ? texto : mostrar(valor);

  return (
    <Campo
      etiqueta={etiqueta}
      error={error || (invalido ? 'Monto inválido (ej.: 15.000,50)' : undefined)}
      ayuda={ayuda}
      render={(a11y) => (
        <div className="input-dinero">
          <span className="input-dinero__signo" aria-hidden="true">
            $
          </span>
          <input
            className="input"
            inputMode="decimal"
            autoComplete="off"
            {...a11y}
            {...props}
            value={visible}
            onFocus={() => {
              setTexto(mostrar(valor));
              setEditando(true);
            }}
            onChange={(e) => {
              const t = e.target.value;
              setTexto(t);
              const cents = t.trim() === '' ? null : aCentavos(t);
              setInvalido(cents === null && t.trim() !== '');
              if (cents !== null || t.trim() === '') onChange(cents);
            }}
            onBlur={() => {
              setEditando(false);
              if (!invalido) setTexto(mostrar(valor));
            }}
          />
        </div>
      )}
    />
  );
}
