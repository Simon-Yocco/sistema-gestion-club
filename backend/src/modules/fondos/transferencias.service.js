// Depósitos y extracciones bancarias (reglas 11.2). Una sola operación genera DOS
// movimientos del mismo monto con signos opuestos: el saldo total no cambia, solo pasa
// dinero de un medio al otro. No son ventas, egresos ni ganancia. Un error se corrige
// registrando la operación inversa.
//   depósito:   −monto efectivo, +monto transferencia ('deposito_bancario')
//   extracción: −monto transferencia, +monto efectivo ('extraccion_bancaria')
import { Op } from 'sequelize';
import { sequelize, TransferenciaMedios, Usuario } from '../../models/index.js';
import { toCents, fromCents } from '../../utils/money.js';
import { hoyArgentina } from '../../utils/fechas.js';
import * as movimientos from './movimientos.service.js';
import { saldosConAdvertencia } from './saldos.service.js';

const CONFIG = {
  deposito: { origen: 'efectivo', destino: 'transferencia', tipo: 'deposito_bancario' },
  extraccion: { origen: 'transferencia', destino: 'efectivo', tipo: 'extraccion_bancaria' },
};

function serializar(t) {
  return {
    id: t.id,
    fecha: t.fecha,
    tipo: t.tipo,
    monto: t.monto,
    descripcion: t.descripcion,
    comprobante: t.comprobante,
    usuario: t.usuario ? { id: t.usuario.id, nombre: t.usuario.nombre } : undefined,
    created_at: t.createdAt,
  };
}

/** 10.3b Registra un depósito o una extracción con sus dos movimientos. */
export async function crear({ fecha, tipo, monto, descripcion, comprobante }, usuario) {
  const { origen, destino, tipo: tipoMov } = CONFIG[tipo];

  return sequelize.transaction(async (transaction) => {
    const registro = await TransferenciaMedios.create(
      {
        fecha: fecha ?? hoyArgentina(),
        tipo,
        monto: fromCents(monto),
        descripcion,
        comprobante,
        usuario_id: usuario.id,
      },
      { transaction },
    );

    const referencia = { referencia_tipo: 'transferencia_medios', referencia_id: registro.id };
    const texto =
      descripcion ?? (tipo === 'deposito' ? 'Depósito bancario' : 'Extracción bancaria');
    await movimientos.registrar(
      { medio: origen, monto: -monto, tipo: tipoMov, ...referencia, descripcion: texto },
      usuario,
      transaction,
    );
    await movimientos.registrar(
      { medio: destino, monto, tipo: tipoMov, ...referencia, descripcion: texto },
      usuario,
      transaction,
    );

    return {
      transferencia: serializar(registro),
      ...(await saldosConAdvertencia([origen], { transaction })),
    };
  });
}

/** 10.3c Listado por fecha y tipo, con los totales de cada tipo en el período filtrado. */
export async function listar({ desde, hasta, tipo, pagina, por_pagina }) {
  const where = {};
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha[Op.gte] = desde;
    if (hasta) where.fecha[Op.lte] = hasta;
  }
  if (tipo) where.tipo = tipo;

  const { rows, count } = await TransferenciaMedios.findAndCountAll({
    where,
    include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] }],
    order: [
      ['fecha', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: por_pagina,
    offset: (pagina - 1) * por_pagina,
  });

  const totalDe = async (t) =>
    fromCents(
      toCents(
        String((await TransferenciaMedios.sum('monto', { where: { ...where, tipo: t } })) ?? 0),
      ),
    );

  return {
    transferencias: rows.map(serializar),
    total_depositos: tipo === 'extraccion' ? '0.00' : await totalDe('deposito'),
    total_extracciones: tipo === 'deposito' ? '0.00' : await totalDe('extraccion'),
    paginacion: { pagina, por_pagina, total: count },
  };
}
