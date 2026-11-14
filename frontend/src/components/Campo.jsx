import { useId } from 'react';

/** Etiqueta + control + ayuda/error. El control recibe id y aria-* automáticamente. */
export function Campo({ etiqueta, error, ayuda, children, render }) {
  const id = useId();
  const idMensaje = `${id}-mensaje`;
  const props = {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || ayuda ? idMensaje : undefined,
  };
  return (
    <div className={`campo ${error ? 'campo--error' : ''}`}>
      <label htmlFor={id} className="campo__etiqueta">
        {etiqueta}
      </label>
      {render ? render(props) : children}
      {(error || ayuda) && (
        <small id={idMensaje} className={error ? 'campo__error' : 'campo__ayuda'}>
          {error || ayuda}
        </small>
      )}
    </div>
  );
}

/** Input de texto con etiqueta. */
export function Input({ etiqueta, error, ayuda, ...props }) {
  return (
    <Campo
      etiqueta={etiqueta}
      error={error}
      ayuda={ayuda}
      render={(a11y) => <input className="input" {...a11y} {...props} />}
    />
  );
}

/** Select con etiqueta. opciones: [{ valor, texto }]. */
export function Select({ etiqueta, error, ayuda, opciones, vacio, ...props }) {
  return (
    <Campo
      etiqueta={etiqueta}
      error={error}
      ayuda={ayuda}
      render={(a11y) => (
        <select className="input" {...a11y} {...props}>
          {vacio !== undefined && <option value="">{vacio}</option>}
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      )}
    />
  );
}
