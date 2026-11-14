// Préstamos de la comisión directiva (reglas 11.1). No son ganancia ni venta: solo afectan
// el saldo y la deuda con la comisión. Existen únicamente como movimientos de fondos:
//   recibido   → 'prestamo_recibido'   (+)
//   devolucion → 'devolucion_prestamo' (−), se admiten devoluciones parciales.
import { sequelize, MovimientoFondos, Usuario } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { toCents, fromCents } from '../../utils/money.js';
import * as movimientos from './movimientos.service.js';
import { prestamosEnCentavos, saldosConAdvertencia } from './saldos.service.js';

const TIPOS = { recibido: 'prestamo_recibido', devolucion: 'devolucion_prestamo' };

/** 10.3 Registra un préstamo recibido o una devolución a la comisión. */
export async function registrar({ tipo, monto, medio, descripcion }, usuario) {
  return sequelize.transaction(async (transaction) => {
    if (tipo === 'devolucion') {
      // Bloquea los movimientos de préstamos para que dos devoluciones simultáneas no
      // superen la deuda.
      await sequelize.query(
        `SELECT id FROM movimiento_fondos
         WHERE tipo IN ('prestamo_recibido', 'devolucion_prestamo') FOR UPDATE`,
        { transaction },
      );
      const { deuda } = await prestamosEnCentavos({ transaction });
      if (monto > deuda) {
        throw AppError.badRequest(
          'DEVOLUCION_EXCEDE_DEUDA',
          `La deuda con la comisión es $${fromCents(deuda)}: no se pueden devolver $${fromCents(monto)}.`,
          { deuda: fromCents(deuda), monto: fromCents(monto) },
        );
      }
    }

    const mov = await movimientos.registrar(
      {
        medio,
        monto: tipo === 'recibido' ? monto : -monto,
        tipo: TIPOS[tipo],
        descripcion:
          descripcion ??
          (tipo === 'recibido' ? 'Préstamo de la comisión' : 'Devolución a la comisión'),
      },
      usuario,
      transaction,
    );

    const prestamos = await prestamosEnCentavos({ transaction });
    return {
      movimiento: {
        id: mov.id,
        tipo: mov.tipo,
        medio: mov.medio,
        monto: mov.monto,
        fecha: mov.fecha,
      },
      deuda_comision: fromCents(prestamos.deuda),
      ...(await saldosConAdvertencia(tipo === 'devolucion' ? [medio] : [], { transaction })),
    };
  });
}

/** Historial de préstamos y devoluciones, del más reciente al más viejo, con la deuda actual. */
export async function listar({ pagina, por_pagina }) {
  const { rows, count } = await MovimientoFondos.findAndCountAll({
    where: { tipo: Object.values(TIPOS) },
    include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nombre'] }],
    order: [
      ['fecha', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: por_pagina,
    offset: (pagina - 1) * por_pagina,
  });
  const prestamos = await prestamosEnCentavos();
  return {
    movimientos: rows.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo === 'prestamo_recibido' ? 'recibido' : 'devolucion',
      medio: m.medio,
      monto: fromCents(Math.abs(toCents(m.monto))),
      descripcion: m.descripcion,
      usuario: { id: m.usuario.id, nombre: m.usuario.nombre },
    })),
    recibidos: fromCents(prestamos.recibidos),
    devueltos: fromCents(prestamos.devueltos),
    deuda_comision: fromCents(prestamos.deuda),
    paginacion: { pagina, por_pagina, total: count },
  };
}
