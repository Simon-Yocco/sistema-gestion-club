import { useRef, useState } from 'react';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { partesFecha } from '../utils/formato.js';

/** "Buen día" / "Buenas tardes" / "Buenas noches" según la hora ("HH:MM"). */
export function saludo(hora) {
  const h = Number(hora.slice(0, 2));
  if (h >= 6 && h < 13) return 'Buen día';
  if (h >= 13 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

const COLORES_PAPELITOS = ['#00296b', '#dd0000', '#ffffff'];
const sinMovimiento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Papelitos con los colores del club que salen desde (x, y) dentro de `contenedor`. */
function tirarPapelitos(contenedor, x, y) {
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('span');
    p.className = 'papelito';
    const angulo = Math.random() * Math.PI * 2;
    const distancia = 80 + Math.random() * 180;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = COLORES_PAPELITOS[i % COLORES_PAPELITOS.length];
    p.style.setProperty('--dx', `${Math.cos(angulo) * distancia}px`);
    p.style.setProperty('--dy', `${Math.sin(angulo) * distancia + 120}px`);
    p.style.setProperty('--giro', `${Math.random() * 720 - 360}deg`);
    p.addEventListener('animationend', () => p.remove());
    contenedor.appendChild(p);
  }
}

/**
 * Inicio: una bienvenida, sin datos de la tienda (los números están en Reportes y en cada
 * pantalla). Escudo, el lema del club y el saludo del día. Igual para todos los roles.
 * Interactiva: la tarjeta se inclina siguiendo el mouse y el escudo, al tocarlo, gira y
 * tira papelitos azules, rojos y blancos.
 */
export function InicioPage() {
  const { usuario } = useAuth();
  const ahora = partesFecha(new Date().toISOString());
  const tarjeta = useRef(null);
  const [girando, setGirando] = useState(false);

  const inclinar = (e) => {
    if (sinMovimiento() || !tarjeta.current) return;
    const r = tarjeta.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5; // -0.5 … 0.5
    const y = (e.clientY - r.top) / r.height - 0.5;
    tarjeta.current.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
    tarjeta.current.style.setProperty('--ry', `${(x * 14).toFixed(2)}deg`);
    tarjeta.current.style.setProperty('--luz-x', `${(x + 0.5) * 100}%`);
    tarjeta.current.style.setProperty('--luz-y', `${(y + 0.5) * 100}%`);
  };
  const enderezar = () => {
    tarjeta.current?.style.setProperty('--rx', '0deg');
    tarjeta.current?.style.setProperty('--ry', '0deg');
  };

  const festejar = (e) => {
    setGirando(true);
    if (sinMovimiento() || !tarjeta.current) return;
    const r = tarjeta.current.getBoundingClientRect();
    const b = e.currentTarget.getBoundingClientRect();
    tirarPapelitos(tarjeta.current, b.left + b.width / 2 - r.left, b.top + b.height / 2 - r.top);
  };

  return (
    <section className="bienvenida">
      <div
        ref={tarjeta}
        className="bienvenida__tarjeta"
        onMouseMove={inclinar}
        onMouseLeave={enderezar}
      >
        <button
          type="button"
          className={`bienvenida__boton-escudo ${girando ? 'bienvenida__boton-escudo--girando' : ''}`}
          onClick={festejar}
          onAnimationEnd={() => setGirando(false)}
          aria-label="Festejar"
          title="¡Tocame!"
        >
          <img className="bienvenida__escudo" src="/escudo.webp" alt="Escudo del club" />
        </button>
        <img className="bienvenida__lema" src="/lema.webp" alt="Fieles, Gloriosos y Eternos" />
      </div>
      <h1 className="bienvenida__saludo">
        {saludo(ahora.hora)}, {usuario.nombre}
      </h1>
      <p className="bienvenida__fecha">
        {ahora.dia} {ahora.fecha}
      </p>
    </section>
  );
}
