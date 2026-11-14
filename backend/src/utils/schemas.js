// Esquemas Zod reutilizables entre módulos.
import { z } from 'zod';
import { toCents, fromCents } from './money.js';

/** :id numérico positivo. */
export const idSchema = z.coerce.number().int().positive();
export const idParams = z.object({ id: idSchema });

/**
 * Monto de dinero en la API. Se acepta como string ("15000.50") o number (15000.5),
 * con hasta 2 decimales, y se devuelve en CENTAVOS enteros para usar en el service.
 * En las respuestas el dinero sale como string con 2 decimales (tal como viene de DECIMAL).
 */
export const dineroSchema = z
  .union([z.string().trim(), z.number()])
  .refine((v) => /^-?\d+(\.\d{1,2})?$/.test(String(v)), {
    message: 'Monto inválido: usar números con hasta 2 decimales (ej. 15000.50).',
  })
  .transform((v) => toCents(v))
  .refine((c) => Math.abs(c) <= 999_999_999_999, { message: 'Monto demasiado grande.' });

/** Monto ≥ 0 (precios, costos). */
export const dineroNoNegativo = dineroSchema.refine((c) => c >= 0, {
  message: 'El monto no puede ser negativo.',
});

/** Monto > 0 (pagos, egresos, préstamos). */
export const dineroPositivo = dineroSchema.refine((c) => c > 0, {
  message: 'El monto debe ser mayor a cero.',
});

/** Centavos → string DECIMAL, para guardar en la base. */
export const aDecimal = fromCents;

/** Query string booleano: "true" | "false" → boolean | undefined. */
export const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

/** Texto opcional: string vacío → null. */
export const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
