import { z } from 'zod';
import {
  MEDIOS_PAGO,
  CONCEPTOS_EGRESO,
  TIPOS_TRANSFERENCIA_MEDIOS,
  TIPOS_MOVIMIENTO,
} from '../../config/constantes.js';
import {
  idSchema,
  dineroPositivo,
  fechaNoFutura,
  textoOpcional,
  paginacionQuery,
  rangoFechasQuery,
  rangoValido,
} from '../../utils/schemas.js';

const medio = z.enum(MEDIOS_PAGO, { message: 'Medio inválido (efectivo o transferencia).' });

// ---------------------------------------------------------------- Egresos (10.1, 10.2)

export const egresoBody = z
  .object({
    fecha: fechaNoFutura.optional(),
    monto: dineroPositivo,
    medio,
    concepto: z.enum(CONCEPTOS_EGRESO, { message: 'Concepto inválido (mercaderia u otro).' }),
    descripcion: textoOpcional(2000),
    comprobante: textoOpcional(50),
    /** Ingreso de mercadería que paga (opcional, solo con concepto "mercaderia"). */
    ingreso_mercaderia_id: idSchema.nullish(),
  })
  .strict()
  .refine((d) => !d.ingreso_mercaderia_id || d.concepto === 'mercaderia', {
    message: 'Solo un egreso de mercadería puede referenciar un ingreso.',
    path: ['ingreso_mercaderia_id'],
  });

export const listarEgresosQuery = z
  .object({
    ...rangoFechasQuery,
    concepto: z.enum(CONCEPTOS_EGRESO).optional(),
    medio: medio.optional(),
    ...paginacionQuery,
  })
  .refine(...rangoValido);

// ---------------------------------------------------------------- Préstamos (10.3)

export const prestamoBody = z
  .object({
    /** recibido: la comisión le presta a la tienda · devolucion: la tienda le devuelve */
    tipo: z.enum(['recibido', 'devolucion'], { message: 'Tipo inválido (recibido o devolucion).' }),
    monto: dineroPositivo,
    medio,
    descripcion: textoOpcional(255),
  })
  .strict();

export const listarPrestamosQuery = z.object({ ...paginacionQuery });

// ---------------------------------------------------------------- Depósitos / extracciones (10.3b, 10.3c)

export const transferenciaMediosBody = z
  .object({
    fecha: fechaNoFutura.optional(),
    tipo: z.enum(TIPOS_TRANSFERENCIA_MEDIOS, {
      message: 'Tipo inválido (deposito o extraccion).',
    }),
    monto: dineroPositivo,
    descripcion: textoOpcional(2000),
    comprobante: textoOpcional(50),
  })
  .strict();

export const listarTransferenciasQuery = z
  .object({
    ...rangoFechasQuery,
    tipo: z.enum(TIPOS_TRANSFERENCIA_MEDIOS).optional(),
    ...paginacionQuery,
  })
  .refine(...rangoValido);

// ---------------------------------------------------------------- Movimientos (10.5)

export const listarMovimientosQuery = z
  .object({
    ...rangoFechasQuery,
    medio: medio.optional(),
    tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
    ...paginacionQuery,
  })
  .refine(...rangoValido);
