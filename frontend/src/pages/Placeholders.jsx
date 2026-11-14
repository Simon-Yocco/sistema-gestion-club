import { Link } from 'react-router-dom';

/** Pantallas que se construyen en las fases 13 y 14. */
export function EnConstruccion({ titulo }) {
  return (
    <section>
      <h1>{titulo}</h1>
      <p>Esta pantalla todavía está en construcción.</p>
    </section>
  );
}

export function NoEncontrada() {
  return (
    <section>
      <h1>Página no encontrada</h1>
      <Link to="/">Volver al inicio</Link>
    </section>
  );
}
