// Devoluciones y anulaciones (reglas, sección 10).
//  - Devolución parcial: el cliente devuelve una o más prendas y se lleva el dinero.
//  - Anulación total: se anula la venta completa.
// En ambos casos el stock vuelve; en ventas fiadas primero se reduce la deuda y solo se
// devuelve dinero si lo pagado supera el nuevo total. El motivo es obligatorio.
import { sequelize, VentaItem, Devolucion, DevolucionItem } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { fromCents } from '../../utils/money.js';
import * as stockService from '../stock/stock.service.js';
import { cargarVenta, obtener as obtenerVenta } from '../ventas/ventas.service.js';
import { resumen, cantidadVigente } from '../ventas/ventaCalculos.js';
import {
  reintegrar,
  resolverReintegros,
  proponerReintegro,
  serializarReintegros,
} from './reintegro.service.js';

function exigirActiva(venta) {
  if (venta.estado === 'anulada') {
    throw AppError.conflict('VENTA_ANULADA', 'La venta está anulada: no admite devoluciones.');
  }
}

/**
 * Valida las prendas a devolver y calcula cómo queda la venta (sin tocar la base).
 * Devuelve las líneas a aplicar y los importes en centavos.
 */
export function planificar(venta, items) {
  const ids = items.map((i) => i.venta_item_id);
  const repetidos = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (repetidos.length > 0) {
    throw AppError.badRequest('ITEM_DUPLICADO', 'Hay prendas repetidas en la devolución.', {
      venta_items: repetidos,
    });
  }

  const porId = new Map(venta.items.map((i) => [i.id, i]));
  const lineas = items.map(({ venta_item_id, cantidad }) => {
    const item = porId.get(venta_item_id);
    if (!item) {
      throw AppError.badRequest(
        'ITEM_NO_PERTENECE_A_VENTA',
        `El ítem ${venta_item_id} no es de esta venta.`,
        { venta_item_id },
      );
    }
    const vigente = cantidadVigente(item);
    if (cantidad > vigente) {
      const prenda = `${item.variante.producto.nombre} ${item.variante.color} ${item.variante.talle}`;
      throw AppError.badRequest(
        'CANTIDAD_DEVUELTA_EXCEDE',
        `De ${prenda} quedan ${vigente} sin devolver: no se pueden devolver ${cantidad}.`,
        { venta_item_id, disponible: vigente, solicitado: cantidad },
      );
    }
    return { item, cantidad };
  });

  // Cómo queda la venta si se aplica la devolución.
  const devueltas = new Map(lineas.map((l) => [l.item.id, l.cantidad]));
  const itemsDespues = venta.items.map((i) => ({
    precio_unitario: i.precio_unitario,
    costo_unitario: i.costo_unitario,
    cantidad: i.cantidad,
    cantidad_devuelta: i.cantidad_devuelta + (devueltas.get(i.id) ?? 0),
  }));
  const antes = resumen(venta);
  const despues = resumen({ items: itemsDespues, pagos: venta.pagos });

  // Regla 10: en ventas fiadas primero baja la deuda; solo se devuelve dinero si lo
  // pagado supera el nuevo total.
  const aReintegrar = Math.max(0, despues.pagado - despues.total);

  return {
    lineas,
    total_actual: antes.total,
    total_nuevo: despues.total,
    pagado: antes.pagado,
    a_reintegrar: aReintegrar,
    deuda_resultante: Math.max(0, despues.total - despues.pagado),
  };
}

/** Repone stock, suma cantidad_devuelta y registra la devolución con sus ítems. */
async function aplicar(venta, plan, { tipo, motivo }, usuario, transaction) {
  for (const { item, cantidad } of plan.lineas) {
    await VentaItem.update(
      { cantidad_devuelta: item.cantidad_devuelta + cantidad },
      { where: { id: item.id }, transaction },
    );
    await stockService.reponer(item.variante_id, cantidad, transaction);
  }
  const devolucion = await Devolucion.create(
    { venta_id: venta.id, tipo, motivo, usuario_id: usuario.id },
    { transaction },
  );
  if (plan.lineas.length > 0) {
    await DevolucionItem.bulkCreate(
      plan.lineas.map(({ item, cantidad }) => ({
        devolucion_id: devolucion.id,
        venta_item_id: item.id,
        cantidad,
      })),
      { transaction },
    );
  }
  return devolucion;
}

const serializarPlan = (plan, reintegros) => ({
  total_actual: fromCents(plan.total_actual),
  total_nuevo: fromCents(plan.total_nuevo),
  pagado: fromCents(plan.pagado),
  a_reintegrar: fromCents(plan.a_reintegrar),
  deuda_resultante: fromCents(plan.deuda_resultante),
  reintegro: serializarReintegros(reintegros),
});

// ---------------------------------------------------------------- 8.2 Devolución parcial

/** Calcula una devolución sin guardarla: para mostrar cuánto se devuelve y en qué medio. */
export async function previsualizarDevolucion(ventaId, { items }) {
  const venta = await cargarVenta(ventaId);
  exigirActiva(venta);
  const plan = planificar(venta, items);
  return serializarPlan(plan, proponerReintegro(venta, plan.a_reintegrar));
}

export async function devolver(ventaId, { items, motivo, reintegro }, usuario) {
  const resultado = await sequelize.transaction(async (transaction) => {
    const venta = await cargarVenta(ventaId, { transaction, lock: true });
    exigirActiva(venta);

    const plan = planificar(venta, items);
    const reintegros = resolverReintegros(venta, plan.a_reintegrar, reintegro);

    const devolucion = await aplicar(
      venta,
      plan,
      { tipo: 'devolucion', motivo },
      usuario,
      transaction,
    );
    await reintegrar(
      venta,
      reintegros,
      'devolucion_anulacion',
      usuario,
      transaction,
      `Devolución venta #${venta.id}`,
    );
    return { id: devolucion.id, ...serializarPlan(plan, reintegros) };
  });

  return { devolucion: resultado, venta: await obtenerVenta(ventaId) };
}

// ---------------------------------------------------------------- 8.3 Anulación total

/** Todas las prendas que siguen vendidas. */
const todoLoVigente = (venta) =>
  venta.items
    .filter((i) => cantidadVigente(i) > 0)
    .map((i) => ({ venta_item_id: i.id, cantidad: cantidadVigente(i) }));

export async function previsualizarAnulacion(ventaId) {
  const venta = await cargarVenta(ventaId);
  exigirActiva(venta);
  const plan = planificar(venta, todoLoVigente(venta));
  return serializarPlan(plan, proponerReintegro(venta, plan.a_reintegrar));
}

/**
 * Anula la venta completa: equivale a devolver todas las prendas que siguen vendidas,
 * reintegrar todo lo cobrado neto, y marcarla como anulada con motivo, usuario y fecha.
 * Una venta anulada ya no admite pagos, cambios ni devoluciones.
 */
export async function anular(ventaId, { motivo, reintegro }, usuario) {
  const resultado = await sequelize.transaction(async (transaction) => {
    const venta = await cargarVenta(ventaId, { transaction, lock: true });
    exigirActiva(venta);

    const plan = planificar(venta, todoLoVigente(venta));
    const reintegros = resolverReintegros(venta, plan.a_reintegrar, reintegro);

    const devolucion = await aplicar(
      venta,
      plan,
      { tipo: 'anulacion', motivo },
      usuario,
      transaction,
    );
    await reintegrar(
      venta,
      reintegros,
      'devolucion_anulacion',
      usuario,
      transaction,
      `Anulación venta #${venta.id}`,
    );
    await venta.update(
      {
        estado: 'anulada',
        motivo_anulacion: motivo,
        anulada_por: usuario.id,
        anulada_at: new Date(),
      },
      { transaction },
    );
    return { id: devolucion.id, ...serializarPlan(plan, reintegros) };
  });

  return { anulacion: resultado, venta: await obtenerVenta(ventaId) };
}
