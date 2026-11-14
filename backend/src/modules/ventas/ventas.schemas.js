import { z } from 'zod';
import { MEDIOS_PAGO } from '../../config/constantes.js';
import { idSchema, dineroPositivo } from '../../utils/schemas.js';
import { compradorBody } from '../compradores/compradores.schemas.js';

/** Un pago: medio + monto (> 0). En el service llega en centavos. */
export const pagoSchema = z.object({
  medio: z.enum(MEDIOS_PAGO, { message: 'Medio de pago inválido (efectivo o transferencia).' }),
  monto: dineroPositivo,
});

export const pagosSchema = z.array(pagoSchema).max(10);

export const crearBody = z
  .object({
    /** Comprador existente… */
    comprador_id: idSchema.optional(),
    /** …o uno nuevo creado en el momento (alcanza el nombre si se paga todo). */
    comprador: compradorBody.optional(),
    items: z
      .array(
        z.object({
          variante_id: idSchema,
          cantidad: z.number().int('La cantidad debe ser entera.').positive().max(1000),
        }),
      )
      .min(1, 'La venta tiene que tener al menos una prenda.')
      .max(100),
    /** 0, 1 o varios pagos (pago mixto). Sin pagos = fiado total. */
    pagos: pagosSchema.default([]),
  })
  .strict()
  .refine((d) => !(d.comprador_id && d.comprador), {
    message: 'Indicá comprador_id o comprador, no los dos.',
    path: ['comprador'],
  });
