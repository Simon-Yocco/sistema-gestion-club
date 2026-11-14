// Egresos (reglas, sección 12): pagos que hace la tienda desde secretaría (mercadería u otros
// gastos). Cada egreso genera un movimiento de fondos negativo en su medio.
import { Op } from 'sequelize';
import { sequelize, Egreso, IngresoMercaderia, Usuario } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { toCents, fromCents } from '../../utils/money.js';
import { hoyArgentina } from '../../utils/fechas.js';
import * as movimientos from './movimientos.service.js';
import { saldosConAdvertencia } from './saldos.service.js';

function serializar(e) {
  return {
    id: e.id,
    fecha: e.fecha,
    monto: e.monto,
    medio: e.medio,
    concepto: e.concepto,
    descripcion: e.descripcion,
    comprobante: e.comprobante,
    ingreso_mercaderia_id: e.ingreso_mercaderia_id,
    usuario: e.usuario ? { id: e.usuario.id, nombre: e.usuario.nombre } : undefined,
    created_at: e.createdAt,
  };
}

/**
 * 10.1 Registra un egreso y su movimiento negativo. Si el saldo del medio queda negativo,
 * NO bloquea: la respuesta incluye `advertencia: { code: 'SALDO_NEGATIVO' }`.
 */
export async function crear(datos, usuario) {
  return sequelize.transaction(async (transaction) => {
    if (datos.ingreso_mercaderia_id) {
      const ingreso = await IngresoMercaderia.findByPk(datos.ingreso_mercaderia_id, {
        transaction,
      });
      if (!ingreso) {
        throw AppError.badRequest(
          'INGRESO_NO_ENCONTRADO',
          'El ingreso de mercadería indicado no existe.',
        );
      }
    }

    const egreso = await Egreso.create(
      {
        fecha: datos.fecha ?? hoyArgentina(),
        monto: fromCents(datos.monto),
        medio: datos.medio,
        concepto: datos.concepto,
        descripcion: datos.descripcion,
        comprobante: datos.comprobante,
        ingreso_mercaderia_id: datos.ingreso_mercaderia_id ?? null,
        usuario_id: usuario.id,
      },
      { transaction },
    );
    await movimientos.registrar(
      {
        medio: datos.medio,
        monto: -datos.monto,
        tipo: 'egreso',
        referencia_tipo: 'egreso',
        referencia_id: egreso.id,
        descripcion:
          datos.descripcion ??
          (datos.concepto === 'mercaderia' ? 'Compra de mercadería' : 'Egreso'),
      },
      usuario,
      transaction,
    );

    return {
      egreso: serializar(egreso),
      ...(await saldosConAdvertencia([datos.medio], { transaction })),
    };
  });
}

/** 10.2 Listado con filtros por fecha, concepto y medio; incluye el total filtrado. */
export async function listar({ desde, hasta, concepto, medio, pagina, por_pagina }) {
  const where = {};
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha[Op.gte] = desde;
    if (hasta) where.fecha[Op.lte] = hasta;
  }
  if (concepto) where.concepto = concepto;
  if (medio) where.medio = medio;

  const { rows, count } = await Egreso.findAndCountAll({
    where,
    include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] }],
    order: [
      ['fecha', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: por_pagina,
    offset: (pagina - 1) * por_pagina,
  });
  const total = (await Egreso.sum('monto', { where })) ?? 0;

  return {
    egresos: rows.map(serializar),
    total: fromCents(toCents(String(total))),
    paginacion: { pagina, por_pagina, total: count },
  };
}
