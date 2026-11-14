// Fechas: en la base se guardan en UTC; las fechas "de calendario" (DATE) se interpretan
// en hora de Argentina, que es como las ve secretaría.
import { env } from '../config/env.js';

// Argentina usa UTC−3 todo el año (sin horario de verano desde 2009).
const OFFSET_ARGENTINA = '-03:00';

/** Instante (UTC) en que empieza el día 'YYYY-MM-DD' en Argentina. */
export function inicioDiaArgentina(fecha) {
  return new Date(`${fecha}T00:00:00${OFFSET_ARGENTINA}`);
}

/** Instante (UTC) en que empieza el día SIGUIENTE a 'YYYY-MM-DD' en Argentina (límite exclusivo). */
export function finDiaArgentina(fecha) {
  const inicio = inicioDiaArgentina(fecha);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Date → 'YYYY-MM-DD HH:MM:SS' en UTC, para usar como parámetro en consultas raw.
 * (Pasar un Date directo lo formatea en la hora local de la máquina.)
 */
export function aSQLUTC(fecha) {
  return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

/** DATETIME de una consulta raw ('YYYY-MM-DD HH:MM:SS' en UTC, o Date) → ISO 8601. */
export function aISO(valor) {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  return new Date(`${String(valor).replace(' ', 'T')}Z`).toISOString();
}

/** Fecha de hoy en Argentina, como 'YYYY-MM-DD'. */
export function hoyArgentina(ahora = new Date()) {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: env.TZ_DISPLAY,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}
