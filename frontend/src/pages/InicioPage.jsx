import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { menuPara } from '../routes/menu.js';
import { IndicadorSaldos } from '../features/fondos/Saldos.jsx';
import { DashboardPage } from './admin/DashboardPage.jsx';

/**
 * Inicio. Secretaría: saldos y accesos grandes a las tareas del día.
 * Administración: el dashboard (14.4).
 */
export function InicioPage() {
  const { usuario, puede } = useAuth();
  if (puede('reportes.ver')) return <DashboardPage />;

  const accesos = menuPara(puede).filter((i) => i.grupo === 'secretaria');
  return (
    <section>
      <h1>Hola, {usuario.nombre}</h1>
      <IndicadorSaldos />
      <div className="accesos">
        {accesos.map((a) => (
          <Link
            key={a.ruta}
            to={a.ruta}
            className={`acceso ${a.destacado ? 'acceso--destacado' : ''}`}
          >
            {a.texto}
          </Link>
        ))}
      </div>
    </section>
  );
}
