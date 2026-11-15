import { z } from 'zod';
import {
  idSchema,
  fechaNoFutura,
  textoOpcional,
  paginacionQuery,
  rangoFechasQuery,
  rangoValido,
} from '../../utils/schemas.js';

export const ESTADOS_PAGO_INGRESO = ['no_pagado', 'parcial', 'pagado'];

const cantidad = z.number().int('La cantidad debe ser entera.').positive().max(100_000);

export const crearBody = z.object({
  /** Si no se indica, hoy (Argentina). */
  fecha: fechaNoFutura.optional(),
  proveedor: textoOpcional(100),
  observaciones: textoOpcional(2000),
  /**
   * Cada ítem es una variante existente ({ variante_id, cantidad }) o un producto con color
   * y talle ({ producto_id, color, talle, cantidad }): si esa combinación todavía no existe,
   * se crea la variante en el mismo ingreso (por ejemplo, un talle nuevo que trajo el
   * proveedor).
   */
  items: z
    .array(
      z.union([
        z
          .object({
            variante_id: idSchema,
            cantidad,
          })
          .strict(),
        z
          .object({
            producto_id: idSchema,
            color: z.string().trim().min(1, 'Falta el color.').max(40),
            talle: z.string().trim().min(1, 'Falta el talle.').max(20),
            cantidad,
          })
          .strict(),
      ]),
    )
    .min(1, 'El ingreso tiene que tener al menos un ítem.')
    .max(500),
});

export const listarQuery = z
  .object({
    ...rangoFechasQuery,
    estado_pago: z.enum(ESTADOS_PAGO_INGRESO).optional(),
    ...paginacionQuery,
  })
  .refine(...rangoValido);
