// 12.4 Proveedores (TanStack Query, auth, avisos) y rutas de la aplicación.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { Layout } from './components/Layout.jsx';
import { RutaProtegida } from './routes/RutaProtegida.jsx';
import { MENU } from './routes/menu.js';
import { LoginPage } from './pages/LoginPage.jsx';
import { InicioPage } from './pages/InicioPage.jsx';
import { EnConstruccion, NoEncontrada } from './pages/Placeholders.jsx';

export function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // No reintentar errores de negocio (4xx): solo fallas de red o del servidor.
        retry: (intentos, error) => intentos < 2 && !(error?.status >= 400 && error?.status < 500),
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** Las pantallas reales reemplazan a EnConstruccion en las fases 13 y 14. */
const PANTALLAS = {};

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route index element={<InicioPage />} />
        {MENU.map((item) => {
          const Pantalla = PANTALLAS[item.ruta];
          return (
            <Route
              key={item.ruta}
              path={item.ruta}
              element={
                <RutaProtegida permiso={item.permiso}>
                  {Pantalla ? <Pantalla /> : <EnConstruccion titulo={item.texto} />}
                </RutaProtegida>
              }
            />
          );
        })}
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  );
}

export function App({ queryClient = crearQueryClient() }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
