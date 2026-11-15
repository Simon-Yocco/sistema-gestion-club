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
import { normalizarColor, normalizarTalle, claveTexto } from '../../utils/talles.js';

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
/**
 * Ítems con { producto_id, color, talle }: busca la variante (sin distinguir mayúsculas ni
 * acentos) y, si no existe, la crea con stock 0. Si estaba desactivada, la reactiva: si
 * entra mercadería es para venderla. Devuelve los ítems como { variante_id, cantidad }.
 */
async function resolverVariantes(items, transaction) {
  const resueltos = [];
  for (const item of items) {
    if (item.variante_id) {
      resueltos.push({ variante_id: item.variante_id, cantidad: item.cantidad });
      continue;
    }
    const producto = await Producto.findByPk(item.producto_id, {
      include: [{ model: Variante, as: 'variantes' }],
      transaction,
    });
    if (!producto) {
      throw AppError.badRequest('PRODUCTO_NO_ENCONTRADO', 'El producto no existe.', {
        producto_id: item.producto_id,
      });
    }
    const color = normalizarColor(item.color);
    const talle = normalizarTalle(item.talle);
    let variante = producto.variantes.find(
      (v) => claveTexto(v.color) === claveTexto(color) && claveTexto(v.talle) === claveTexto(talle),
    );
    if (!variante) {
      variante = await Variante.create(
        { producto_id: producto.id, color, talle, stock: 0 },
        { transaction },
      );
    } else if (!variante.activo) {
      await variante.update({ activo: true }, { transaction });
    }
    resueltos.push({ variante_id: variante.id, cantidad: item.cantidad });
  }
  return resueltos;
}

export async function crear({ fecha, proveedor, observaciones, items: pedidos }, usuario) {
  const id = await sequelize.transaction(async (transaction) => {
    const items = await resolverVariantes(pedidos, transaction);
    const repetidas = items
      .map((i) => i.variante_id)
      .filter((vid, i, ids) => ids.indexOf(vid) !== i);
    if (repetidas.length > 0) {
      throw AppError.badRequest(
        'ITEM_DUPLICADO',
        'Hay variantes repetidas en el ingreso: sumá las cantidades en un solo ítem.',
        { variantes: [...new Set(repetidas)] },
      );
    }

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

/**
 * 5.2 Listado con totales a costo, lo pagado (egresos asociados) y el estado de pago.
 * Filtros: rango de fechas y estado de pago. Paginado, del más reciente al más viejo.
 */
export async function listar({ desde, hasta, estado_pago, pagina, por_pagina }) {
  const condiciones = [];
  const replacements = {};
  if (desde) {
    condiciones.push('im.fecha >= :desde');
    replacements.desde = desde;
  }
  if (hasta) {
    condiciones.push('im.fecha <= :hasta');
    replacements.hasta = hasta;
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const base = `
    SELECT im.id, im.fecha, im.proveedor, im.observaciones,
           u.id AS usuario_id, u.nombre AS usuario_nombre,
           COALESCE(it.unidades, 0) AS unidades,
           COALESCE(it.total, 0) AS total,
           COALESCE(eg.pagado, 0) AS pagado
    FROM ingreso_mercaderia im
    JOIN usuario u ON u.id = im.usuario_id
    LEFT JOIN (
      SELECT ingreso_id, SUM(cantidad) AS unidades, SUM(cantidad * costo_unitario) AS total
      FROM ingreso_item GROUP BY ingreso_id
    ) it ON it.ingreso_id = im.id
    LEFT JOIN (
      SELECT ingreso_mercaderia_id, SUM(monto) AS pagado
      FROM egreso WHERE ingreso_mercaderia_id IS NOT NULL GROUP BY ingreso_mercaderia_id
    ) eg ON eg.ingreso_mercaderia_id = im.id
    ${where}`;

  const filtroEstado =
    {
      no_pagado: 'WHERE x.pagado <= 0',
      parcial: 'WHERE x.pagado > 0 AND x.pagado < x.total',
      pagado: 'WHERE x.pagado > 0 AND x.pagado >= x.total',
    }[estado_pago] ?? '';

  const [filas] = await sequelize.query(
    `SELECT * FROM (${base}) x ${filtroEstado}
     ORDER BY x.fecha DESC, x.id DESC
     LIMIT :limite OFFSET :offset`,
    { replacements: { ...replacements, limite: por_pagina, offset: (pagina - 1) * por_pagina } },
  );
  const [[{ total }]] = await sequelize.query(
    `SELECT COUNT(*) AS total FROM (${base}) x ${filtroEstado}`,
    { replacements },
  );

  return {
    ingresos: filas.map((f) => {
      const totalCents = toCents(String(f.total));
      const pagadoCents = toCents(String(f.pagado));
      return {
        id: f.id,
        fecha: f.fecha,
        proveedor: f.proveedor,
        observaciones: f.observaciones,
        usuario: { id: f.usuario_id, nombre: f.usuario_nombre },
        unidades: Number(f.unidades),
        total: fromCents(totalCents),
        pagado: fromCents(pagadoCents),
        estado_pago: estadoPago(totalCents, pagadoCents),
      };
    }),
    paginacion: { pagina, por_pagina, total: Number(total) },
  };
}
