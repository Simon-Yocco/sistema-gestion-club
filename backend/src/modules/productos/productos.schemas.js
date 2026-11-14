import { z } from 'zod';
import { booleanQuery } from '../../utils/schemas.js';

export const listarQuery = z.object({
  q: z.string().trim().max(100).optional(),
  activo: booleanQuery,
});
