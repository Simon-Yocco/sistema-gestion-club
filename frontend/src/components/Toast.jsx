// Avisos breves de éxito o error ("Venta registrada", "No hay stock…").
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
const DURACION_MS = 4500;
let siguienteId = 1;

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([]);

  const quitar = useCallback((id) => setAvisos((a) => a.filter((x) => x.id !== id)), []);
  const mostrar = useCallback(
    (tipo, texto) => {
      const id = siguienteId++;
      setAvisos((a) => [...a, { id, tipo, texto }]);
      setTimeout(() => quitar(id), DURACION_MS);
    },
    [quitar],
  );

  const api = useMemo(
    () => ({
      exito: (texto) => mostrar('exito', texto),
      error: (texto) => mostrar('error', texto),
      aviso: (texto) => mostrar('aviso', texto),
    }),
    [mostrar],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {avisos.map((a) => (
          <div
            key={a.id}
            className={`toast toast--${a.tipo}`}
            role={a.tipo === 'error' ? 'alert' : 'status'}
          >
            <span>{a.texto}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => quitar(a.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast tiene que usarse dentro de <ToastProvider>.');
  return ctx;
}
