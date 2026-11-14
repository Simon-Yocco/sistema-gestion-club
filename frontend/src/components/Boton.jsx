/**
 * Botón. variante: primario | secundario | peligro | texto. tamano: normal | grande.
 * `cargando` lo deshabilita y muestra "…" para evitar dobles clics (por ej. al confirmar
 * una venta).
 */
export function Boton({
  variante = 'primario',
  tamano = 'normal',
  cargando = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={`boton boton--${variante} boton--${tamano} ${className}`.trim()}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando ? 'Procesando…' : children}
    </button>
  );
}
