import { useEffect, useState } from 'react';

/** Devuelve `valor` recién cuando dejó de cambiar `ms` milisegundos (para buscadores). */
export function useDemorado(valor, ms = 250) {
  const [demorado, setDemorado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setDemorado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return demorado;
}
