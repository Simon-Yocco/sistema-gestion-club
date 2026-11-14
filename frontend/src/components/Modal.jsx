import { useEffect, useId, useRef } from 'react';
import { Boton } from './Boton.jsx';

/** Ventana modal. Se cierra con Escape, con la ✕ o haciendo clic afuera. */
export function Modal({ abierto, titulo, onCerrar, children, pie, ancho = 'normal' }) {
  const idTitulo = useId();
  const caja = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const alPresionar = (e) => e.key === 'Escape' && onCerrar?.();
    document.addEventListener('keydown', alPresionar);
    caja.current?.focus();
    return () => document.removeEventListener('keydown', alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="modal__fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div
        ref={caja}
        className={`modal modal--${ancho}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        <header className="modal__cabecera">
          <h2 id={idTitulo}>{titulo}</h2>
          {onCerrar && (
            <Boton variante="texto" onClick={onCerrar} aria-label="Cerrar">
              ✕
            </Boton>
          )}
        </header>
        <div className="modal__cuerpo">{children}</div>
        {pie && <footer className="modal__pie">{pie}</footer>}
      </div>
    </div>
  );
}

/**
 * Confirmación antes de una acción importante. Muestra un resumen y dos botones.
 * `peligro` pinta el botón de confirmar en rojo (anular, devolver dinero).
 */
export function Confirmacion({
  abierto,
  titulo,
  children,
  textoConfirmar = 'Confirmar',
  peligro = false,
  cargando = false,
  deshabilitado = false,
  onConfirmar,
  onCancelar,
}) {
  return (
    <Modal
      abierto={abierto}
      titulo={titulo}
      onCerrar={cargando ? undefined : onCancelar}
      pie={
        <>
          <Boton variante="secundario" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </Boton>
          <Boton
            variante={peligro ? 'peligro' : 'primario'}
            onClick={onConfirmar}
            cargando={cargando}
            disabled={deshabilitado}
          >
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      {children}
    </Modal>
  );
}
