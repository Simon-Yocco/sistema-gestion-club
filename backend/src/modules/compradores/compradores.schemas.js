import { z } from 'zod';
import { textoOpcional } from '../../utils/schemas.js';

const nombre = z.string().trim().min(1, 'Ingresá el nombre.').max(100);
const numeroSocio = textoOpcional(20);
const telefono = textoOpcional(30).refine((t) => t === null || /^[\d\s()+-]{6,30}$/.test(t), {
  message: 'Teléfono inválido.',
});

/** Datos de un comprador (también se usa para crearlo en el momento de la venta). */
export const compradorBody = z.object({ nombre, numero_socio: numeroSocio, telefono });

export const editarBody = z
  .object({ nombre, numero_socio: numeroSocio, telefono })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'Indicá al menos un campo a modificar.');

export const listarQuery = z.object({
  q: z.string().trim().max(100).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});
