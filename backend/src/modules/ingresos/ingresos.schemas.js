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

export const crearBody = z.object({
  /** Si no se indica, hoy (Argentina). */
  fecha: fechaNoFutura.optional(),
  proveedor: textoOpcional(100),
  observaciones: textoOpcional(2000),
  items: z
    .array(
      z.object({
        variante_id: idSchema,
        cantidad: z.number().int('La cantidad debe ser entera.').positive().max(100_000),
      }),
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
