// Fechas: en la base se guardan en UTC; las fechas "de calendario" (DATE) se interpretan
// en hora de Argentina, que es como las ve secretaría.
import { env } from '../config/env.js';

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
