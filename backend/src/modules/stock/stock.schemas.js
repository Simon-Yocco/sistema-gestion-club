import { z } from 'zod';
import { idSchema } from '../../utils/schemas.js';

export const consultarQuery = z.object({
  q: z.string().trim().max(100).optional(),
  producto_id: idSchema.optional(),
  /** sin_stock: solo stock 0 · con_stock: solo stock > 0 · (vacío): todas */
  estado: z.enum(['sin_stock', 'con_stock']).optional(),
});
