import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, crearQueryClient } from '../src/App.jsx';
import { AuthProvider } from '../src/features/auth/AuthContext.jsx';
import { ToastProvider } from '../src/components/Toast.jsx';

const SECRETARIA = {
  usuario: { id: 2, nombre: 'Sole', username: 'sole', rol: 'secretaria', activo: true },
  permisos: ['ventas.registrar', 'ventas.consultar', 'deudores.consultar', 'stock.consultar'],
};
const ADMIN = {
  usuario: { id: 1, nombre: 'Ana', username: 'ana', rol: 'admin', activo: true },
  permisos: [...SECRETARIA.permisos, 'productos.gestionar', 'reportes.ver', 'usuarios.gestionar'],
};

const json = (status, body) =>
  Promise.resolve(new Response(body === null ? null : JSON.stringify(body), { status }));
const noAutenticado = () =>
  json(401, { error: { code: 'NO_AUTENTICADO', message: 'Tenés que iniciar sesión.' } });

/** Simula la API: `sesion` es quién está logueado (null = nadie). */
function simularApi({ sesion = null, credenciales = { sole: SECRETARIA } } = {}) {
  let actual = sesion;
  const fetchMock = vi.fn((url, opciones = {}) => {
    if (url.endsWith('/auth/me')) return actual ? json(200, actual) : noAutenticado();
    if (url.endsWith('/auth/login')) {
      const { username, password } = JSON.parse(opciones.body);
      const s = credenciales[username];
      if (!s || password !== 'clave1234') {
        return json(401, {
          error: { code: 'CREDENCIALES_INVALIDAS', message: 'Usuario o contraseña incorrectos.' },
        });
      }
      actual = s;
      return json(200, s);
    }
    if (url.endsWith('/auth/logout')) {
      actual = null;
      return json(204, null);
    }
    return json(404, { error: { code: 'X', message: 'no' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderApp(ruta) {
  return render(
    <QueryClientProvider client={crearQueryClient()}>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[ruta]}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('login y rutas protegidas', () => {
  it('sin sesión, cualquier pantalla lleva al login', async () => {
    simularApi();
    renderApp('/ventas');
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('login correcto vuelve a la pantalla pedida y muestra el menú de secretaría', async () => {
    simularApi();
    renderApp('/ventas');

    await userEvent.type(await screen.findByLabelText('Usuario'), 'sole');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave1234');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('heading', { name: 'Ventas' })).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Menú principal' });
    expect(menu).toHaveTextContent('Nueva venta');
    expect(menu).not.toHaveTextContent('Reportes');
  });

  it('login incorrecto muestra el mensaje del backend y borra la contraseña', async () => {
    simularApi();
    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Usuario'), 'sole');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'mala');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('secretaría que entra a una pantalla de admin es redirigida al inicio', async () => {
    simularApi({ sesion: SECRETARIA });
    renderApp('/reportes');
    expect(await screen.findByRole('heading', { name: 'Hola, Sole' })).toBeInTheDocument();
  });

  it('el admin ve también el menú de gestión y puede entrar a reportes', async () => {
    simularApi({ sesion: ADMIN });
    renderApp('/reportes');
    expect(await screen.findByRole('heading', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Menú principal' })).toHaveTextContent(
      'Usuarios',
    );
  });

  it('salir cierra la sesión y vuelve al login', async () => {
    const fetchMock = simularApi({ sesion: SECRETARIA });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Salir' }));

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/auth\/logout$/),
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      ),
    );
  });
});
