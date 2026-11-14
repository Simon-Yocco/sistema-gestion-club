import { z } from 'zod';
import { idSchema, textoOpcional } from '../../utils/schemas.js';
import { pagosSchema } from '../ventas/ventas.schemas.js';
import { compradorBody } from '../compradores/compradores.schemas.js';

const cantidad = z.number().int('La cantidad debe ser entera.').positive().max(1000);

/** Campos comunes a los dos tipos de cambio. */
const comunes = {
  cantidad_devuelta: cantidad.default(1),
  variante_nueva_id: idSchema,
  cantidad_nueva: cantidad.default(1),
  motivo: textoOpcional(2000),
  /** Cobro de la diferencia cuando la prenda nueva es más cara (puede ser mixto). */
  pagos: pagosSchema.optional(),
  /** Cómo devolver la diferencia cuando corresponde (si no se indica, se propone). */
  reintegro: pagosSchema.optional(),
};

/** 9.1 Cambio sobre una venta registrada. */
export const cambioBody = z.object({ venta_item_id: idSchema, ...comunes }).strict();

export const previsualizarCambioBody = cambioBody
  .omit({ motivo: true, pagos: true, reintegro: true })
  .strict();

/** 9.2 Cambio sin venta registrada. Comprador opcional (existente o nuevo). */
export const cambioSinVentaBody = z
  .object({
    comprador_id: idSchema.optional(),
    comprador: compradorBody.optional(),
    variante_devuelta_id: idSchema,
    ...comunes,
  })
  .strict()
  .refine((d) => !(d.comprador_id && d.comprador), {
    message: 'Indicá comprador_id o comprador, no los dos.',
    path: ['comprador'],
  });
