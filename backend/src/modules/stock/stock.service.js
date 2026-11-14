// 4.8 Servicio interno de stock. Lo usan ingresos, ventas, devoluciones y cambios.
//
// Principio 4: el stock nunca queda negativo. El descuento es un único UPDATE condicional
// (`... WHERE id = ? AND stock >= ?`): MySQL bloquea la fila, así que si dos ventas quieren
// la última unidad al mismo tiempo, la segunda espera, ve stock 0 y no afecta ninguna fila.
// Siempre dentro de la transacción de la operación: si algo falla después, se revierte todo.
import { QueryTypes } from 'sequelize';
import { sequelize, Variante, Producto } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';

function validarArgs(varianteId, cantidad, transaction) {
  if (!transaction) throw new Error('stockService: se requiere una transacción.');
  if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
    throw new Error(`stockService: cantidad inválida (${cantidad}).`);
  }
  if (!Number.isSafeInteger(varianteId) || varianteId <= 0) {
    throw new Error(`stockService: variante inválida (${varianteId}).`);
  }
}

/** Ejecuta un UPDATE y devuelve cuántas filas modificó. */
async function filasAfectadas(sql, replacements, transaction) {
  const [, afectadas] = await sequelize.query(sql, {
    replacements,
    transaction,
    type: QueryTypes.UPDATE,
  });
  return afectadas;
}

async function varianteConProducto(varianteId, transaction) {
  return Variante.findByPk(varianteId, {
    include: [{ model: Producto, as: 'producto', attributes: ['nombre'] }],
    transaction,
  });
}

/**
 * Descuenta `cantidad` unidades. Si no alcanza el stock lanza 409 STOCK_INSUFICIENTE
 * indicando la variante y cuánto hay disponible.
 */
export async function descontar(varianteId, cantidad, transaction) {
  validarArgs(varianteId, cantidad, transaction);

  const afectadas = await filasAfectadas(
    `UPDATE variante SET stock = stock - :cantidad, updated_at = CURRENT_TIMESTAMP
     WHERE id = :varianteId AND stock >= :cantidad`,
    { varianteId, cantidad },
    transaction,
  );
  if (afectadas === 1) return;

  const variante = await varianteConProducto(varianteId, transaction);
  if (!variante) {
    throw AppError.notFound(`La variante ${varianteId} no existe.`, 'VARIANTE_NO_ENCONTRADA');
  }
  const descripcion = `${variante.producto.nombre} ${variante.color} ${variante.talle}`;
  throw AppError.conflict(
    'STOCK_INSUFICIENTE',
    `No hay stock suficiente de ${descripcion}: pedido ${cantidad}, disponible ${variante.stock}.`,
    {
      variante_id: variante.id,
      producto: variante.producto.nombre,
      color: variante.color,
      talle: variante.talle,
      solicitado: cantidad,
      disponible: variante.stock,
    },
  );
}

/** Suma `cantidad` unidades (ingreso de mercadería, devolución, cambio). */
export async function reponer(varianteId, cantidad, transaction) {
  validarArgs(varianteId, cantidad, transaction);

  const afectadas = await filasAfectadas(
    `UPDATE variante SET stock = stock + :cantidad, updated_at = CURRENT_TIMESTAMP
     WHERE id = :varianteId`,
    { varianteId, cantidad },
    transaction,
  );
  if (afectadas !== 1) {
    throw AppError.notFound(`La variante ${varianteId} no existe.`, 'VARIANTE_NO_ENCONTRADA');
  }
}
