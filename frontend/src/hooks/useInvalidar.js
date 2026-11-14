import { useQueryClient } from '@tanstack/react-query';
import { CLAVES_DINERO, CLAVES_STOCK } from '../api/recursos.js';

/** Después de una operación: refresca saldos, ventas, deudores y stock en pantalla. */
export function useInvalidar() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [...CLAVES_DINERO, ...CLAVES_STOCK].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
}
