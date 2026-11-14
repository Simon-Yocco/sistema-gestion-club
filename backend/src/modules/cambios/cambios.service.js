// Cambios de prenda (reglas, sección 9).
//  - Sin plazo máximo. No hay saldo a favor: la diferencia se resuelve en el momento.
//  - La prenda devuelta vuelve al stock; la nueva se descuenta.
//  - Prenda devuelta: precio al que se vendió. Prenda nueva: precio actual.
//  - Venta pagada: más cara → se cobra la diferencia; más barata → se devuelve; igual → nada.
//  - Venta con deuda (fiado): la diferencia ajusta la deuda; si la deuda quedara negativa,
//    el excedente se devuelve en el momento.
import { sequelize, VentaItem, Cambio } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { toCents, fromCents, multiply, sum } from '../../utils/money.js';
import * as stockService from '../stock/stock.service.js';
import {
  cargarVenta,
  obtener as obtenerVenta,
  variantesVendibles,
} from '../ventas/ventas.service.js';
import { registrarCobros } from '../ventas/pagos.service.js';
import { resumen, cantidadVigente } from '../ventas/ventaCalculos.js';
import {
  reintegrar,
  resolverReintegros,
  proponerReintegro,
  serializarReintegros,
} from '../devoluciones/reintegro.service.js';

/**
 * Decide cómo se resuelve la diferencia, a partir de la deuda de la venta antes del cambio
 * y de la diferencia (valor nuevo − valor devuelto), en centavos.
 * Devuelve { resolucion, a_cobrar, a_reintegrar, deuda_resultante }.
 */
export function resolverDiferencia(deudaAntes, diferencia) {
  const ventaPagada = deudaAntes <= 0;
  const deudaDespues = deudaAntes + diferencia;

  if (ventaPagada && diferencia > 0) {
    return { resolucion: 'cobro', a_cobrar: diferencia, a_reintegrar: 0, deuda_resultante: 0 };
  }
  if (deudaDespues < 0) {
    return {
      resolucion: 'devolucion',
      a_cobrar: 0,
      a_reintegrar: -deudaDespues,
      deuda_resultante: 0,
    };
  }
  return {
    resolucion: diferencia === 0 ? 'sin_diferencia' : 'ajuste_deuda',
    a_cobrar: 0,
    a_reintegrar: 0,
    deuda_resultante: deudaDespues,
  };
}

/** Verifica que los pagos indicados cubran exactamente la diferencia a cobrar. */
function validarCobro(aCobrar, pagos = []) {
  const suma = sum(pagos.map((p) => p.monto));
  if (aCobrar === 0 && suma > 0) {
    throw AppError.badRequest(
      'COBRO_NO_CORRESPONDE',
      'En este cambio no hay diferencia para cobrar.',
    );
  }
  if (suma !== aCobrar) {
    throw AppError.badRequest(
      'COBRO_DIFERENCIA_INCORRECTO',
      `Hay que cobrar $${fromCents(aCobrar)} de diferencia y los pagos suman $${fromCents(suma)}.`,
      { a_cobrar: fromCents(aCobrar), pagado: fromCents(suma) },
    );
  }
}

const serializarCalculo = (calc) => ({
  valor_devuelto: fromCents(calc.valorDevuelto),
  valor_nuevo: fromCents(calc.valorNuevo),
  diferencia: fromCents(calc.diferencia),
  resolucion: calc.resolucion,
  a_cobrar: fromCents(calc.a_cobrar),
  a_reintegrar: fromCents(calc.a_reintegrar),
  deuda_resultante: fromCents(calc.deuda_resultante),
});

// ---------------------------------------------------------------- 9.1 Con venta registrada

/** Valida y calcula un cambio sobre una venta (sin tocar la base). */
async function planificar(venta, datos, transaction) {
  if (venta.estado === 'anulada') {
    throw AppError.conflict('VENTA_ANULADA', 'La venta está anulada: no admite cambios.');
  }
  const item = venta.items.find((i) => i.id === datos.venta_item_id);
  if (!item) {
    throw AppError.badRequest(
      'ITEM_NO_PERTENECE_A_VENTA',
      `El ítem ${datos.venta_item_id} no es de esta venta.`,
    );
  }
  const vigente = cantidadVigente(item);
  if (datos.cantidad_devuelta > vigente) {
    throw AppError.badRequest(
      'CANTIDAD_DEVUELTA_EXCEDE',
      `De esa prenda quedan ${vigente} sin devolver: no se pueden cambiar ${datos.cantidad_devuelta}.`,
      { venta_item_id: item.id, disponible: vigente, solicitado: datos.cantidad_devuelta },
    );
  }

  const variantes = await variantesVendibles(
    [{ variante_id: datos.variante_nueva_id }],
    transaction,
  );
  const nueva = variantes.get(datos.variante_nueva_id);

  const valorDevuelto = multiply(toCents(item.precio_unitario), datos.cantidad_devuelta);
  const valorNuevo = multiply(toCents(nueva.producto.precio_venta), datos.cantidad_nueva);
  const diferencia = valorNuevo - valorDevuelto;
  const { deuda } = resumen(venta);

  return {
    item,
    nueva,
    valorDevuelto,
    valorNuevo,
    diferencia,
    ...resolverDiferencia(deuda, diferencia),
  };
}

/** Calcula el cambio sin guardarlo: para mostrar la diferencia y qué hay que hacer. */
export async function previsualizar(ventaId, datos) {
  const venta = await cargarVenta(ventaId);
  const calc = await planificar(venta, datos);
  return {
    ...serializarCalculo(calc),
    reintegro: serializarReintegros(proponerReintegro(venta, calc.a_reintegrar)),
  };
}

/**
 * 9.1 Cambio sobre una venta registrada, en una transacción:
 *  1. marca la devolución del ítem original y repone su stock;
 *  2. agrega un ítem nuevo (origen 'cambio') con precio y costo actuales y descuenta stock;
 *  3. calcula la diferencia y la resuelve (cobro / reintegro / ajuste de deuda);
 *  4. registra el cambio.
 */
export async function cambiar(ventaId, datos, usuario) {
  const resultado = await sequelize.transaction(async (transaction) => {
    const venta = await cargarVenta(ventaId, { transaction, lock: true });
    const calc = await planificar(venta, datos, transaction);

    validarCobro(calc.a_cobrar, datos.pagos);
    const reintegros = resolverReintegros(venta, calc.a_reintegrar, datos.reintegro);

    // 1. prenda devuelta
    await VentaItem.update(
      { cantidad_devuelta: calc.item.cantidad_devuelta + datos.cantidad_devuelta },
      { where: { id: calc.item.id }, transaction },
    );
    await stockService.reponer(calc.item.variante_id, datos.cantidad_devuelta, transaction);

    // 2. prenda nueva
    const itemNuevo = await VentaItem.create(
      {
        venta_id: venta.id,
        variante_id: calc.nueva.id,
        cantidad: datos.cantidad_nueva,
        precio_unitario: calc.nueva.producto.precio_venta,
        costo_unitario: calc.nueva.producto.costo,
        origen: 'cambio',
      },
      { transaction },
    );
    await stockService.descontar(calc.nueva.id, datos.cantidad_nueva, transaction);

    // 3. diferencia
    if (calc.a_cobrar > 0) {
      await registrarCobros(venta, datos.pagos, 'cobro_diferencia_cambio', usuario, transaction);
    }
    await reintegrar(
      venta,
      reintegros,
      'devolucion_diferencia_cambio',
      usuario,
      transaction,
      `Diferencia por cambio, venta #${venta.id}`,
    );

    // 4. registro del cambio
    const cambio = await Cambio.create(
      {
        venta_id: venta.id,
        venta_item_devuelto_id: calc.item.id,
        variante_devuelta_id: calc.item.variante_id,
        cantidad_devuelta: datos.cantidad_devuelta,
        valor_devuelto: fromCents(calc.valorDevuelto),
        venta_item_nuevo_id: itemNuevo.id,
        cantidad_nueva: datos.cantidad_nueva,
        valor_nuevo: fromCents(calc.valorNuevo),
        diferencia: fromCents(calc.diferencia),
        resolucion: calc.resolucion,
        motivo: datos.motivo ?? null,
        usuario_id: usuario.id,
      },
      { transaction },
    );

    return {
      id: cambio.id,
      ...serializarCalculo(calc),
      reintegro: serializarReintegros(reintegros),
    };
  });

  return { cambio: resultado, venta: await obtenerVenta(ventaId) };
}
