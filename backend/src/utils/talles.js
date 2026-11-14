// Orden natural de talles para mostrar grillas: XS < S < M < L < XL < XXL < XXXL,
// luego los numéricos (2, 4, 6... 38, 40) de menor a mayor y al final el resto alfabético.
const ORDEN_LETRAS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '4XL', '5XL'];

function clave(talle) {
  const t = String(talle).toUpperCase().trim();
  const iLetra = ORDEN_LETRAS.indexOf(t);
  if (iLetra >= 0) return [0, iLetra, ''];
  const n = Number(t.replace(',', '.'));
  if (Number.isFinite(n)) return [1, n, ''];
  return [2, 0, t];
}

export function compararTalles(a, b) {
  const [ga, va, sa] = clave(a);
  const [gb, vb, sb] = clave(b);
  return ga - gb || va - vb || sa.localeCompare(sb, 'es');
}

export function ordenarTalles(talles) {
  return [...talles].sort(compararTalles);
}

/** Normaliza un talle: sin espacios extremos y en mayúsculas ("m " → "M"). */
export const normalizarTalle = (t) => String(t).trim().toUpperCase();

/** Normaliza un color: sin espacios extremos y con la primera letra en mayúscula. */
export function normalizarColor(c) {
  const t = String(c).trim().replace(/\s+/g, ' ');
  return t.charAt(0).toLocaleUpperCase('es') + t.slice(1);
}

/** Clave de comparación sin mayúsculas ni acentos (igual que la collation de MySQL). */
export const claveTexto = (t) =>
  String(t)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
