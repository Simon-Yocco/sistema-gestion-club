import { z } from 'zod';
import { textoOpcional } from '../../utils/schemas.js';

const nombre = z.string().trim().min(1, 'Ingresá el nombre.').max(100);
const apodo = textoOpcional(60);
// Opcional: hoy no se usa para identificar (reglas v1.2), queda por si se implementa.
const numeroSocio = textoOpcional(20);
const telefono = textoOpcional(30).refine((t) => t === null || /^[\d\s()+-]{6,30}$/.test(t), {
  message: 'Teléfono inválido.',
});

const campos = { nombre, apodo, numero_socio: numeroSocio, telefono };

/** Datos de un comprador (también se usa para crearlo en el momento de la venta). */
export const compradorBody = z.object(campos);

export const editarBody = z
  .object(campos)
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'Indicá al menos un campo a modificar.');

export const listarQuery = z.object({
  q: z.string().trim().max(100).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});
