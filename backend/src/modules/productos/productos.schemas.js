import { z } from 'zod';
import { booleanQuery, dineroNoNegativo, idSchema, textoOpcional } from '../../utils/schemas.js';

export const listarQuery = z.object({
  q: z.string().trim().max(100).optional(),
  activo: booleanQuery,
});

const nombre = z.string().trim().min(1, 'Ingresá el nombre.').max(100);
const color = z.string().trim().min(1, 'Color vacío.').max(40);
const talle = z.string().trim().min(1, 'Talle vacío.').max(20);

/**
 * 4.1 Alta: nombre, descripción, marca, precio y costo. Los talles y colores son opcionales
 * (reglas v1.4): normalmente aparecen al ingresar mercadería.
 */
export const crearBody = z.object({
  nombre,
  descripcion: textoOpcional(2000),
  marca: textoOpcional(60),
  precio_venta: dineroNoNegativo,
  costo: dineroNoNegativo,
  colores: z.array(color).max(30).default([]),
  talles: z.array(talle).max(30).default([]),
});

/**
 * 4.4 Edición: nombre, descripción, precio y costo. Al menos un campo.
 * 4.6 También activo: un producto inactivo deja de aparecer para la venta (no se borra).
 */
export const editarBody = z
  .object({
    nombre,
    descripcion: textoOpcional(2000),
    marca: textoOpcional(60),
    precio_venta: dineroNoNegativo,
    costo: dineroNoNegativo,
    activo: z.boolean(),
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

/** 4.6 Activar o desactivar una variante. */
export const varianteParams = z.object({ id: idSchema, varianteId: idSchema });
export const editarVarianteBody = z.object({ activo: z.boolean() }).strict();
