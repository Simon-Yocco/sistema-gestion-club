// 12.9 Formato de dinero y fechas para Argentina.
//
// La API manda el dinero como string con 2 decimales ("15000.50") y fechas en ISO (UTC).
// En pantalla: "$ 15.000,50" y fechas en hora de Argentina.
// Para cuentas en el navegador se usan CENTAVOS enteros, igual que en el backend.

const ZONA = 'America/Argentina/Buenos_Aires';

/** "15000.50" | 1500050 (centavos, con { centavos: true }) → "$ 15.000,50" */
export function formatearPesos(valor, { centavos = false } = {}) {
  if (valor === null || valor === undefined || valor === '') return '';
  const cents = centavos ? Number(valor) : aCentavos(valor);
  if (cents === null) return '';
  const abs = Math.abs(cents);
  const enteros = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimales = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}$ ${enteros},${decimales}`;
}

/**
 * Texto de dinero → centavos. Acepta el formato de la API ("15000.50") y lo que escribe
 * una persona ("15.000,50", "$ 15000", "15000,5"). Devuelve null si no es un monto válido.
 */
export function aCentavos(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? Math.round(valor * 100) : null;
  let t = String(valor ?? '')
    .replace(/\$/g, '')
    .replace(/\s/g, '');
  if (t === '') return null;
  const negativo = t.startsWith('-');
  if (negativo) t = t.slice(1);

  if (/^\d+\.\d{1,2}$/.test(t)) {
    // formato API: punto decimal
  } else {
    // formato argentino: puntos de miles, coma decimal
    if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(t)) return null;
    t = t.replace(/\./g, '').replace(',', '.');
  }
  const [ent, dec = ''] = t.split('.');
  const cents = Number(ent) * 100 + Number(dec.padEnd(2, '0').slice(0, 2));
  return negativo ? -cents : cents;
}

/** Centavos → string para mandar a la API ("15000.50"). */
export function desdeCentavos(cents) {
  const abs = Math.abs(cents);
  const texto = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${texto}` : texto;
}

/** ISO o 'YYYY-MM-DD' → "14/11/2026" (día en Argentina). */
export function formatearFecha(valor) {
  if (!valor) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [a, m, d] = valor.split('-');
    return `${d}/${m}/${a}`;
  }
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(valor));
}

/** ISO → { dia: 'Sábado', fecha: '14/11/2026', hora: '15:30' } en hora de Argentina. */
export function partesFecha(valor) {
  const [fecha, hora] = formatearFechaHora(valor).split(' ');
  const dia = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, weekday: 'long' }).format(
    new Date(valor),
  );
  return { dia: dia.charAt(0).toUpperCase() + dia.slice(1), fecha, hora };
}

/** ISO → "14/11/2026 15:30" en hora de Argentina. */
export function formatearFechaHora(valor) {
  if (!valor) return '';
  const partes = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(valor));
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** Hoy en Argentina como 'YYYY-MM-DD' (para filtros y valores por defecto). */
export function hoy(ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora);
}
