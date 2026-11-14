import { z } from 'zod';
import { idSchema } from '../../utils/schemas.js';
import { pagosSchema } from '../ventas/ventas.schemas.js';

const motivo = z
  .string({ message: 'El motivo es obligatorio.' })
  .trim()
  .min(3, 'El motivo es obligatorio.')
  .max(2000);

/**
 * Cómo devolver el dinero (opcional). Si no se indica, se propone devolver en el medio en
 * que se cobró (8.4). Si se indica, tiene que sumar exactamente lo que corresponde devolver.
 */
const reintegro = pagosSchema.optional();

/** 8.2 Devolución parcial: prendas y cantidades que vuelven. */
export const devolucionBody = z
  .object({
    items: z
      .array(
        z.object({
          venta_item_id: idSchema,
          cantidad: z.number().int('La cantidad debe ser entera.').positive(),
        }),
      )
      .min(1, 'Indicá al menos una prenda a devolver.')
      .max(100),
    motivo,
    reintegro,
  })
  .strict();

/** Previsualización de una devolución (sin motivo ni reintegro: solo calcula). */
export const previsualizarDevolucionBody = devolucionBody
  .omit({ motivo: true, reintegro: true })
  .strict();

/** 8.3 Anulación total. */
export const anularBody = z.object({ motivo, reintegro }).strict();
