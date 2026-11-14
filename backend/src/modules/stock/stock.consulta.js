// 4.7 Consulta de stock por producto / color / talle (solo lo que está a la venta).
import { Op } from 'sequelize';
import { Producto, Variante } from '../../models/index.js';
import { compararTalles } from '../../utils/talles.js';
import { contiene } from '../../utils/sql.js';

export async function consultar({ q, producto_id, estado } = {}) {
  const whereVariante = { activo: true };
  if (estado === 'sin_stock') whereVariante.stock = 0;
  if (estado === 'con_stock') whereVariante.stock = { [Op.gt]: 0 };

  const whereProducto = { activo: true };
  if (producto_id) whereProducto.id = producto_id;
  if (q) whereProducto.nombre = contiene(q);

  const variantes = await Variante.findAll({
    where: whereVariante,
    include: [
      { model: Producto, as: 'producto', where: whereProducto, attributes: ['id', 'nombre'] },
    ],
  });

  const filas = variantes
    .map((v) => ({
      variante_id: v.id,
      producto_id: v.producto.id,
      producto: v.producto.nombre,
      color: v.color,
      talle: v.talle,
      stock: v.stock,
    }))
    .sort(
      (a, b) =>
        a.producto.localeCompare(b.producto, 'es') ||
        a.color.localeCompare(b.color, 'es') ||
        compararTalles(a.talle, b.talle),
    );

  return { filas, total_unidades: filas.reduce((acc, f) => acc + f.stock, 0) };
}
