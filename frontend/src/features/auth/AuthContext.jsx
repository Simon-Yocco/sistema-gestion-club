// 12.5 Contexto de autenticación: usuario actual, sus permisos, login y logout.
// Al cargar la app pregunta a /auth/me si ya hay sesión (la cookie la maneja el navegador).
import { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as authApi from '../../api/auth.js';

const AuthContext = createContext(null);
const CLAVE = ['auth', 'me'];

async function sesionActual() {
  try {
    return await authApi.me();
  } catch (err) {
    if (err.status === 401) return null; // sin sesión: no es un error
    throw err;
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    queryKey: CLAVE,
    queryFn: sesionActual,
    retry: false,
    staleTime: Infinity,
  });

  const login = useCallback(
    async (username, password) => {
      const sesion = await authApi.login(username, password);
      queryClient.setQueryData(CLAVE, sesion);
      return sesion;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Sin sesión, y sin datos de la sesión anterior en caché (ventas, saldos, etc.).
      queryClient.setQueryData(CLAVE, null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    }
  }, [queryClient]);

  const valor = useMemo(() => {
    const permisos = data?.permisos ?? [];
    return {
      usuario: data?.usuario ?? null,
      permisos,
      cargando: isPending,
      error,
      puede: (accion) => permisos.includes(accion),
      login,
      logout,
    };
  }, [data, isPending, error, login, logout]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tiene que usarse dentro de <AuthProvider>.');
  return ctx;
}
