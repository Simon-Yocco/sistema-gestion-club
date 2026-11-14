// Ingreso de mercadería (reglas, sección 4). Lo registra el administrador.
// No mueve dinero: el pago al proveedor es un egreso (sección 12), que puede referenciar
// al ingreso para saber qué compras están pagas.
import {
  sequelize,
  IngresoMercaderia,
  IngresoItem,
  Variante,
  Producto,
  Egreso,
  Usuario,
} from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { toCents, fromCents, sum, multiply } from '../../utils/money.js';
import { hoyArgentina } from '../../utils/fechas.js';
import * as stockService from '../stock/stock.service.js';

/** Estado de pago de un ingreso según lo pagado con egresos asociados (en centavos). */
export function estadoPago(totalCents, pagadoCents) {
  if (pagadoCents <= 0) return 'no_pagado';
  if (pagadoCents < totalCents) return 'parcial';
  return 'pagado';
}

/**
 * 5.1 Registra un ingreso: crea la cabecera y los ítems (con el costo unitario actual del
 * producto, congelado en el ítem) y suma el stock de cada variante. Todo en una transacción.
 */
export async function crear({ fecha, proveedor, observaciones, items }, usuario) {
  const repetidas = items.map((i) => i.variante_id).filter((id, i, ids) => ids.indexOf(id) !== i);
  if (repetidas.length > 0) {
    throw AppError.badRequest(
      'ITEM_DUPLICADO',
      'Hay variantes repetidas en el ingreso: sumá las cantidades en un solo ítem.',
      { variantes: [...new Set(repetidas)] },
    );
  }

  const id = await sequelize.transaction(async (transaction) => {
    const variantes = await Variante.findAll({
      where: { id: items.map((i) => i.variante_id) },
      include: [{ model: Producto, as: 'producto', attributes: ['id', 'costo'] }],
      transaction,
    });
    const porId = new Map(variantes.map((v) => [v.id, v]));
    const faltantes = items.map((i) => i.variante_id).filter((vid) => !porId.has(vid));
    if (faltantes.length > 0) {
      throw AppError.badRequest('VARIANTE_NO_ENCONTRADA', 'Hay variantes que no existen.', {
        variantes: faltantes,
      });
    }

    const ingreso = await IngresoMercaderia.create(
      { fecha: fecha ?? hoyArgentina(), proveedor, observaciones, usuario_id: usuario.id },
      { transaction },
    );

    for (const { variante_id, cantidad } of items) {
      await IngresoItem.create(
        {
          ingreso_id: ingreso.id,
          variante_id,
          cantidad,
          costo_unitario: porId.get(variante_id).producto.costo,
        },
        { transaction },
      );
      await stockService.reponer(variante_id, cantidad, transaction);
    }
    return ingreso.id;
  });

  return obtener(id);
}

/** 5.3 Detalle con ítems, egresos asociados, total a costo y estado de pago. */
export async function obtener(id) {
  const ingreso = await IngresoMercaderia.findByPk(id, {
    include: [
      {
        model: IngresoItem,
        as: 'items',
        include: [
          {
            model: Variante,
            as: 'variante',
            include: [{ model: Producto, as: 'producto', attributes: ['id', 'nombre'] }],
          },
        ],
      },
      { model: Egreso, as: 'egresos' },
      { model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] },
    ],
    order: [
      [{ model: IngresoItem, as: 'items' }, 'id', 'ASC'],
      [{ model: Egreso, as: 'egresos' }, 'id', 'ASC'],
    ],
  });
  if (!ingreso) throw AppError.notFound('El ingreso no existe.', 'INGRESO_NO_ENCONTRADO');

  const items = ingreso.items.map((it) => {
    const subtotal = multiply(toCents(it.costo_unitario), it.cantidad);
    return {
      id: it.id,
      variante_id: it.variante_id,
      producto_id: it.variante.producto.id,
      producto: it.variante.producto.nombre,
      color: it.variante.color,
      talle: it.variante.talle,
      cantidad: it.cantidad,
      costo_unitario: it.costo_unitario,
      subtotal: fromCents(subtotal),
      _subtotal: subtotal,
    };
  });
  const egresos = ingreso.egresos.map((e) => ({
    id: e.id,
    fecha: e.fecha,
    monto: e.monto,
    medio: e.medio,
    comprobante: e.comprobante,
  }));

  const total = sum(items.map((i) => i._subtotal));
  const pagado = sum(egresos.map((e) => toCents(e.monto)));

  return {
    id: ingreso.id,
    fecha: ingreso.fecha,
    proveedor: ingreso.proveedor,
    observaciones: ingreso.observaciones,
    usuario: ingreso.usuario,
    created_at: ingreso.createdAt,
    unidades: items.reduce((acc, i) => acc + i.cantidad, 0),
    total: fromCents(total),
    pagado: fromCents(pagado),
    estado_pago: estadoPago(total, pagado),
    items: items.map(({ _subtotal, ...resto }) => resto),
    egresos,
  };
}
