// 12.3 Cliente HTTP. Todas las llamadas a la API pasan por acá:
//  - manda la cookie de sesión (credentials: 'include');
//  - serializa el body a JSON y arma el query string;
//  - si la API responde error, lanza ApiError con el `message` del backend, listo para
//    mostrar en pantalla, y el `code` para decidir qué hacer.

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function armarUrl(ruta, query) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') params.append(clave, valor);
  }
  const qs = params.toString();
  return `${BASE}${ruta}${qs ? `?${qs}` : ''}`;
}

export async function api(ruta, { method = 'GET', body, query, signal } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(armarUrl(ruta, query), {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'SIN_CONEXION',
      'No se pudo conectar con el servidor. Revisá la conexión.',
    );
  }

  if (respuesta.status === 204) return null;

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const e = datos?.error;
    throw new ApiError(
      respuesta.status,
      e?.code ?? 'ERROR',
      e?.message ?? `Error inesperado (${respuesta.status}).`,
      e?.details ?? null,
    );
  }
  return datos;
}

export const get = (ruta, query, opciones) => api(ruta, { ...opciones, query });
export const post = (ruta, body, opciones) => api(ruta, { ...opciones, method: 'POST', body });
export const patch = (ruta, body, opciones) => api(ruta, { ...opciones, method: 'PATCH', body });

/** URL para descargar un archivo (por ejemplo un reporte en CSV). */
export const urlDescarga = (ruta, query) => armarUrl(ruta, query);
