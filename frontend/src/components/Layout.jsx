// 12.7 Estructura de todas las pantallas con sesión: barra superior (usuario y salir) y
// menú según el rol. Secretaría ve pocas opciones y bien visibles; el admin además ve las
// de gestión, separadas.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { menuPara } from '../routes/menu.js';
import { Boton } from './Boton.jsx';

export function Layout() {
  const { usuario, puede, logout } = useAuth();
  const navigate = useNavigate();
  const items = menuPara(puede).filter((i) => i.enMenu !== false);
  const operacion = items.filter((i) => i.grupo === 'secretaria');
  const gestion = items.filter((i) => i.grupo === 'admin');

  const salir = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const enlace = (item) => (
    <NavLink
      key={item.ruta}
      to={item.ruta}
      end
      className={({ isActive }) =>
        `menu__item ${item.destacado ? 'menu__item--destacado' : ''} ${isActive ? 'menu__item--activo' : ''}`
      }
    >
      {item.texto}
    </NavLink>
  );

  return (
    <div className="app">
      <header className="barra">
        <NavLink to="/" className="barra__titulo">
          Tienda del club
        </NavLink>
        <div className="barra__usuario">
          <span>
            {usuario.nombre}
            <small> · {usuario.rol === 'admin' ? 'Administración' : 'Secretaría'}</small>
          </span>
          <Boton variante="secundario" onClick={salir}>
            Salir
          </Boton>
        </div>
      </header>
      <nav className="menu" aria-label="Menú principal">
        <div className="menu__grupo">
          {enlace({ ruta: '/', texto: 'Inicio' })}
          {operacion.map(enlace)}
        </div>
        {gestion.length > 0 && (
          <div className="menu__grupo menu__grupo--admin">{gestion.map(enlace)}</div>
        )}
      </nav>
      <main className="contenido">
        <Outlet />
      </main>
    </div>
  );
}
