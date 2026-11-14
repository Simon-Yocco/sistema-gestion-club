import { z } from 'zod';
import { ROLES } from '../../config/constantes.js';
import { PASSWORD_MIN } from '../auth/password.js';

export const idParams = z.object({ id: z.coerce.number().int().positive() });

const nombre = z.string().trim().min(1, 'Ingresá el nombre.').max(100);
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9._-]{3,50}$/,
    'Entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.',
  );
// bcrypt solo usa los primeros 72 bytes.
const password = z
  .string()
  .min(PASSWORD_MIN, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`)
  .max(72, 'La contraseña puede tener hasta 72 caracteres.');
const rol = z.enum(ROLES);

export const listarQuery = z.object({
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export const crearBody = z.object({ nombre, username, password, rol });

export const editarBody = z
  .object({ nombre, username, rol, activo: z.boolean() })
  .partial()
  .strict()
  .refine((datos) => Object.keys(datos).length > 0, 'Indicá al menos un campo a modificar.');

export const resetPasswordBody = z.object({ password });
