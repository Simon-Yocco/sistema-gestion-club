// Ventas (reglas, secciones 6, 7 y 8).
import {
  sequelize,
  Venta,
  VentaItem,
  Variante,
  Producto,
  Comprador,
  Pago,
  Devolucion,
  DevolucionItem,
  Cambio,
  Usuario,
} from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { toCents, fromCents, multiply, sum } from '../../utils/money.js';
import * as stockService from '../stock/stock.service.js';
import * as compradores from '../compradores/compradores.service.js';
import { registrarCobros } from './pagos.service.js';
import { resumen, cantidadVigente } from './ventaCalculos.js';

// ---------------------------------------------------------------- Alta

function rechazarRepetidas(items) {
  const ids = items.map((i) => i.variante_id);
  const repetidas = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (repetidas.length > 0) {
    throw AppError.badRequest(
      'ITEM_DUPLICADO',
      'Hay prendas repetidas en la venta: sumá las cantidades en un solo ítem.',
      { variantes: repetidas },
    );
  }
}

/** Carga las variantes con su producto y verifica que existan y estén a la venta. */
async function variantesVendibles(items, transaction) {
  const variantes = await Variante.findAll({
    where: { id: items.map((i) => i.variante_id) },
    include: [{ model: Producto, as: 'producto' }],
    transaction,
  });
  const porId = new Map(variantes.map((v) => [v.id, v]));

  const faltantes = items.map((i) => i.variante_id).filter((id) => !porId.has(id));
  if (faltantes.length > 0) {
    throw AppError.badRequest('VARIANTE_NO_ENCONTRADA', 'Hay prendas que no existen.', {
      variantes: faltantes,
    });
  }
  const inactivas = variantes.filter((v) => !v.activo || !v.producto.activo);
  if (inactivas.length > 0) {
    throw AppError.conflict(
      'VARIANTE_INACTIVA',
      `No se puede vender: ${inactivas
        .map((v) => `${v.producto.nombre} ${v.color} ${v.talle}`)
        .join(', ')} no está a la venta.`,
      { variantes: inactivas.map((v) => v.id) },
    );
  }
  return porId;
}

async function resolverComprador({ comprador_id, comprador }, transaction) {
  if (comprador_id) return compradores.buscar(comprador_id, { transaction });
  if (comprador) return compradores.crear(comprador, { transaction });
  return null;
}

/**
 * 6.4 Registra una venta. Dentro de una sola transacción:
 *  1. valida las prendas (existen, están activas, sin repetir);
 *  2. calcula el total con el precio actual y valida Σ pagos ≤ total (PAGO_EXCEDE_TOTAL);
 *  3. si queda deuda (fiado), exige comprador identificable (COMPRADOR_REQUERIDO_FIADO);
 *  4. crea la venta y los ítems con precio y costo congelados, y descuenta el stock
 *     (STOCK_INSUFICIENTE si no alcanza);
 *  5. crea los pagos y un movimiento de fondos `cobro_venta` por cada uno.
 * Si algo falla, no se guarda nada.
 */
export async function crear(datos, usuario) {
  rechazarRepetidas(datos.items);

  const id = await sequelize.transaction(async (transaction) => {
    const variantes = await variantesVendibles(datos.items, transaction);

    const lineas = datos.items.map(({ variante_id, cantidad }) => {
      const { producto } = variantes.get(variante_id);
      return {
        variante_id,
        cantidad,
        precio_unitario: producto.precio_venta,
        costo_unitario: producto.costo,
      };
    });
    const total = sum(lineas.map((l) => multiply(toCents(l.precio_unitario), l.cantidad)));
    const pagado = sum(datos.pagos.map((p) => p.monto));

    if (pagado > total) {
      throw AppError.badRequest(
        'PAGO_EXCEDE_TOTAL',
        `Los pagos ($${fromCents(pagado)}) superan el total de la venta ($${fromCents(total)}).`,
        { total: fromCents(total), pagado: fromCents(pagado) },
      );
    }

    const comprador = await resolverComprador(datos, transaction);
    if (pagado < total && !compradores.esIdentificable(comprador)) {
      throw AppError.badRequest(
        'COMPRADOR_REQUERIDO_FIADO',
        'Si queda saldo pendiente (fiado), el comprador tiene que tener número de socio o teléfono.',
        { total: fromCents(total), pagado: fromCents(pagado) },
      );
    }

    const venta = await Venta.create(
      { comprador_id: comprador?.id ?? null, usuario_id: usuario.id },
      { transaction },
    );
    for (const linea of lineas) {
      await VentaItem.create({ ...linea, venta_id: venta.id, origen: 'venta' }, { transaction });
      await stockService.descontar(linea.variante_id, linea.cantidad, transaction);
    }
    await registrarCobros(venta, datos.pagos, 'cobro_venta', usuario, transaction);

    return venta.id;
  });

  return obtener(id, { verCostos: false });
}

// ---------------------------------------------------------------- Detalle

const persona = (u) => (u ? { id: u.id, nombre: u.nombre } : null);

/** Carga la venta con todo lo necesario para calcular y mostrar. */
export async function cargarVenta(id, { transaction, lock } = {}) {
  const venta = await Venta.findByPk(id, {
    include: [
      { model: Comprador, as: 'comprador' },
      { model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] },
      { model: Usuario, as: 'anuladaPor', attributes: ['id', 'nombre'] },
      {
        model: VentaItem,
        as: 'items',
        include: [
          {
            model: Variante,
            as: 'variante',
            include: [{ model: Producto, as: 'producto', attributes: ['id', 'nombre'] }],
          },
        ],
      },
      {
        model: Pago,
        as: 'pagos',
        include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] }],
      },
      {
        model: Devolucion,
        as: 'devoluciones',
        include: [
          { model: DevolucionItem, as: 'items' },
          { model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] },
        ],
      },
      { model: Cambio, as: 'cambios' },
    ],
    order: [
      [{ model: VentaItem, as: 'items' }, 'id', 'ASC'],
      [{ model: Pago, as: 'pagos' }, 'id', 'ASC'],
      [{ model: Devolucion, as: 'devoluciones' }, 'id', 'ASC'],
      [{ model: Cambio, as: 'cambios' }, 'id', 'ASC'],
    ],
    transaction,
  });
  if (!venta) throw AppError.notFound('La venta no existe.', 'VENTA_NO_ENCONTRADA');
  if (lock) {
    // Bloquea la fila de la venta hasta el fin de la transacción (operaciones concurrentes
    // sobre la misma venta, como dos cobros a la vez, se hacen de a una).
    await Venta.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  }
  return venta;
}

/**
 * 6.6 Detalle completo de una venta: ítems, pagos, devoluciones y cambios, con total,
 * pagado, deuda y estado de pago calculados. Costos y ganancia solo con `verCostos`.
 */
export function serializar(venta, { verCostos = false } = {}) {
  const calculo = resumen(venta);
  return {
    id: venta.id,
    fecha: venta.fecha,
    estado: venta.estado,
    motivo_anulacion: venta.motivo_anulacion,
    anulada_at: venta.anulada_at,
    anulada_por: persona(venta.anuladaPor),
    comprador: venta.comprador ? compradores.serializar(venta.comprador) : null,
    usuario: persona(venta.usuario),
    items: venta.items.map((i) => ({
      id: i.id,
      variante_id: i.variante_id,
      producto_id: i.variante.producto.id,
      producto: i.variante.producto.nombre,
      color: i.variante.color,
      talle: i.variante.talle,
      cantidad: i.cantidad,
      cantidad_devuelta: i.cantidad_devuelta,
      cantidad_vigente: cantidadVigente(i),
      precio_unitario: i.precio_unitario,
      ...(verCostos ? { costo_unitario: i.costo_unitario } : {}),
      subtotal: fromCents(multiply(toCents(i.precio_unitario), cantidadVigente(i))),
      origen: i.origen,
    })),
    pagos: venta.pagos.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      medio: p.medio,
      monto: p.monto,
      tipo: p.tipo,
      usuario: persona(p.usuario),
    })),
    devoluciones: venta.devoluciones.map((d) => ({
      id: d.id,
      fecha: d.fecha,
      tipo: d.tipo,
      motivo: d.motivo,
      usuario: persona(d.usuario),
      items: d.items.map((di) => ({ venta_item_id: di.venta_item_id, cantidad: di.cantidad })),
    })),
    cambios: venta.cambios.map((c) => ({
      id: c.id,
      fecha: c.fecha,
      venta_item_devuelto_id: c.venta_item_devuelto_id,
      cantidad_devuelta: c.cantidad_devuelta,
      valor_devuelto: c.valor_devuelto,
      venta_item_nuevo_id: c.venta_item_nuevo_id,
      cantidad_nueva: c.cantidad_nueva,
      valor_nuevo: c.valor_nuevo,
      diferencia: c.diferencia,
      resolucion: c.resolucion,
      motivo: c.motivo,
    })),
    total: fromCents(calculo.total),
    pagado: fromCents(calculo.pagado),
    deuda: fromCents(calculo.deuda),
    estado_pago: calculo.estado_pago,
    ...(verCostos ? { ganancia: fromCents(calculo.ganancia) } : {}),
  };
}

export async function obtener(id, opciones = {}) {
  return serializar(await cargarVenta(id), opciones);
}
