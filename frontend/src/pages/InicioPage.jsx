import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { menuPara } from '../routes/menu.js';
import { IndicadorSaldos } from '../features/fondos/Saldos.jsx';
import { DashboardPage } from './admin/DashboardPage.jsx';
import { partesFecha } from '../utils/formato.js';

/** "Buen día" / "Buenas tardes" / "Buenas noches" según la hora ("HH:MM"). */
export function saludo(hora) {
  const h = Number(hora.slice(0, 2));
  if (h >= 6 && h < 13) return 'Buen día';
  if (h >= 13 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Inicio. Secretaría: saludo, saldos de la tienda, el acceso grande a "Nueva venta" y
 * tarjetas con el resto de las tareas del día. Administración: el dashboard (14.4).
 */
export function InicioPage() {
  const { usuario, puede } = useAuth();
  if (puede('reportes.ver')) return <DashboardPage />;

  const ahora = partesFecha(new Date().toISOString());
  const tareas = menuPara(puede).filter((i) => i.grupo === 'secretaria');
  const principal = tareas.find((t) => t.destacado);
  const resto = tareas.filter((t) => !t.destacado);

  return (
    <section className="inicio">
      <header className="inicio__saludo">
        <h1>
          {saludo(ahora.hora)}, {usuario.nombre}
        </h1>
        <p>
          {ahora.dia} {ahora.fecha}
        </p>
      </header>

      <IndicadorSaldos />

      {principal && (
        <Link to={principal.ruta} className="acceso acceso--destacado acceso--principal">
          <strong>{principal.texto}</strong>
          <span>{principal.descripcion}</span>
        </Link>
      )}

      <h2>¿Qué querés hacer?</h2>
      <div className="accesos">
        {resto.map((a) => (
          <Link key={a.ruta} to={a.ruta} className="acceso">
            <strong>{a.texto}</strong>
            {a.descripcion && <span>{a.descripcion}</span>}
          </Link>
        ))}
      </div>
    </section>
  );
}
