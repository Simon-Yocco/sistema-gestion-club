export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando" role="status" aria-live="polite">
      <span className="cargando__spinner" aria-hidden="true" />
      {texto}
    </div>
  );
}
