/**
 * Utilidades de dinero. En JS el dinero se maneja SIEMPRE en centavos enteros
 * para evitar errores de redondeo de punto flotante (0.1 + 0.2 !== 0.3).
 * En MySQL se guarda como DECIMAL(12,2), que mysql2 devuelve como string.
 *
 *   toCents('15000.50') → 1500050
 *   fromCents(1500050)  → '15000.50'   (para guardar en DECIMAL)
 *   formatARS(1500050)  → '$ 15.000,50'
 */

const DECIMAL_RE = /^([+-])?(\d+)(?:\.(\d+))?$/;

function assertCents(value, nombre = 'monto') {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${nombre} debe ser un entero de centavos (recibido: ${value})`);
  }
}

/**
 * Convierte un valor decimal (string de DECIMAL, o number) a centavos enteros.
 * Redondea a 2 decimales "mitad lejos de cero" (1.005 → 101, -1.005 → -101),
 * trabajando sobre el texto para no arrastrar errores de float.
 */
export function toCents(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Monto inválido: ${value}`);
    value = numberToPlainString(value);
  }
  if (typeof value !== 'string') throw new TypeError(`Monto inválido: ${value}`);

  const match = DECIMAL_RE.exec(value.trim());
  if (!match) throw new TypeError(`Monto inválido: "${value}"`);

  const [, signo, enteros, decimales = ''] = match;
  const dec = decimales.padEnd(3, '0');
  let cents = Number(enteros) * 100 + Number(dec.slice(0, 2));
  if (Number(dec[2]) >= 5) cents += 1;

  if (!Number.isSafeInteger(cents)) throw new RangeError(`Monto fuera de rango: "${value}"`);
  return signo === '-' && cents !== 0 ? -cents : cents;
}

/** number → string sin notación exponencial (1e-7 → "0.0000001"). */
function numberToPlainString(n) {
  const s = String(n);
  if (!/e/i.test(s)) return s;
  return n.toFixed(20).replace(/\.?0+$/, '');
}

/** Centavos → string con 2 decimales, listo para una columna DECIMAL(12,2). */
export function fromCents(cents) {
  assertCents(cents);
  const abs = Math.abs(cents);
  const texto = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${texto}` : texto;
}

/** Suma de centavos. Acepta varios argumentos o un array. */
export function sum(...values) {
  const lista = values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  return lista.reduce((acc, v) => {
    assertCents(v);
    return acc + v;
  }, 0);
}

export function add(a, b) {
  assertCents(a, 'a');
  assertCents(b, 'b');
  return a + b;
}

export function subtract(a, b) {
  assertCents(a, 'a');
  assertCents(b, 'b');
  return a - b;
}

/** Precio unitario (centavos) × cantidad (entera). */
export function multiply(cents, cantidad) {
  assertCents(cents);
  if (!Number.isSafeInteger(cantidad)) {
    throw new TypeError(`La cantidad debe ser entera (recibido: ${cantidad})`);
  }
  return cents * cantidad;
}

/** Formato argentino: 1500050 → "$ 15.000,50"; -1500050 → "-$ 15.000,50". */
export function formatARS(cents) {
  assertCents(cents);
  const abs = Math.abs(cents);
  const enteros = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimales = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '-' : ''}$ ${enteros},${decimales}`;
}
