// 12.6 Rutas protegidas. Sin sesión → login. Sin permiso → inicio.
// (Es solo para la navegación: la validación real de permisos está en la API.)
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { Cargando } from '../components/Cargando.jsx';

export function RutaProtegida({ permiso, children }) {
  const { usuario, cargando, puede } = useAuth();
  const location = useLocation();

  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  if (permiso && !puede(permiso)) return <Navigate to="/" replace />;
  return children ?? <Outlet />;
}
