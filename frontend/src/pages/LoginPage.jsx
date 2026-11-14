// 12.10 Pantalla de login.
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext.jsx';
import { Input } from '../components/Campo.jsx';
import { Boton } from '../components/Boton.jsx';
import { Cargando } from '../components/Cargando.jsx';

export function LoginPage() {
  const { usuario, cargando, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (cargando) return <Cargando />;
  if (usuario) return <Navigate to={location.state?.desde ?? '/'} replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Ingresá usuario y contraseña.');
      return;
    }
    setEnviando(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.desde ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <form className="login__caja" onSubmit={enviar} noValidate>
        <h1>Tienda del club</h1>
        <Input
          etiqueta="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />
        <Input
          etiqueta="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && (
          <p className="alerta alerta--error" role="alert">
            {error}
          </p>
        )}
        <Boton type="submit" tamano="grande" cargando={enviando}>
          Ingresar
        </Boton>
      </form>
    </div>
  );
}
