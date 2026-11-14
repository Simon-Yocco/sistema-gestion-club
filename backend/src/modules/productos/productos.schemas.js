import { z } from 'zod';
import { booleanQuery, dineroNoNegativo, textoOpcional } from '../../utils/schemas.js';

export const listarQuery = z.object({
  q: z.string().trim().max(100).optional(),
  activo: booleanQuery,
});

const nombre = z.string().trim().min(1, 'Ingresá el nombre.').max(100);
const color = z.string().trim().min(1, 'Color vacío.').max(40);
const talle = z.string().trim().min(1, 'Talle vacío.').max(20);

export const crearBody = z.object({
  nombre,
  descripcion: textoOpcional(2000),
  precio_venta: dineroNoNegativo,
  costo: dineroNoNegativo,
  colores: z.array(color).min(1, 'Indicá al menos un color.').max(30),
  talles: z.array(talle).min(1, 'Indicá al menos un talle.').max(30),
});

/** 4.4 Edición: nombre, descripción, precio y costo. Al menos un campo. */
export const editarBody = z
  .object({
    nombre,
    descripcion: textoOpcional(2000),
    precio_venta: dineroNoNegativo,
    costo: dineroNoNegativo,
  })
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, 'Indicá al menos un campo a modificar.');

/** 4.5 Nuevos colores y/o talles para un producto existente. */
export const agregarVariantesBody = z
  .object({
    colores: z.array(color).max(30).default([]),
    talles: z.array(talle).max(30).default([]),
  })
  .strict()
  .refine((d) => d.colores.length + d.talles.length > 0, 'Indicá al menos un color o talle nuevo.');
