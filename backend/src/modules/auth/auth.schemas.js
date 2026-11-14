import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Ingresá el usuario.'),
  password: z.string().min(1, 'Ingresá la contraseña.'),
});
