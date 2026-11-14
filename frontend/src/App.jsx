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
import { NuevaVentaPage } from './pages/NuevaVentaPage.jsx';
import { VentasPage } from './pages/VentasPage.jsx';
import { DetalleVentaPage } from './pages/DetalleVentaPage.jsx';
import { DeudoresPage, CuentaCompradorPage } from './pages/DeudoresPage.jsx';
import { StockPage } from './pages/StockPage.jsx';
import { CambioSinVentaPage } from './pages/CambioSinVentaPage.jsx';
import { EgresosPage, PrestamosPage, BancoPage } from './pages/FondosPages.jsx';
import { ProductosPage } from './pages/admin/ProductosPage.jsx';
import { IngresosPage } from './pages/admin/IngresosPage.jsx';
import { ReportesPage } from './pages/admin/ReportesPage.jsx';
import { MovimientosPage } from './pages/admin/MovimientosPage.jsx';
import { UsuariosPage } from './pages/admin/UsuariosPage.jsx';

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

/** Pantalla de cada opción del menú. Las que faltan muestran "en construcción" (fase 14). */
const PANTALLAS = {
  '/ventas/nueva': NuevaVentaPage,
  '/ventas': VentasPage,
  '/deudores': DeudoresPage,
  '/stock': StockPage,
  '/cambios/sin-venta': CambioSinVentaPage,
  '/egresos': EgresosPage,
  '/prestamos': PrestamosPage,
  '/banco': BancoPage,
  '/productos': ProductosPage,
  '/ingresos': IngresosPage,
  '/reportes': ReportesPage,
  '/movimientos': MovimientosPage,
  '/usuarios': UsuariosPage,
};

/** Pantallas que no están en el menú (se llega desde otra). */
const OTRAS = [
  { ruta: '/ventas/:id', permiso: 'ventas.consultar', Pantalla: DetalleVentaPage },
  { ruta: '/deudores/:id', permiso: 'deudores.consultar', Pantalla: CuentaCompradorPage },
];

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
        {OTRAS.map(({ ruta, permiso, Pantalla }) => (
          <Route
            key={ruta}
            path={ruta}
            element={
              <RutaProtegida permiso={permiso}>
                <Pantalla />
              </RutaProtegida>
            }
          />
        ))}
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
