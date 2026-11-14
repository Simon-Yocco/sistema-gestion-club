// Productos y variantes (reglas, sección 3).
import { Op } from 'sequelize';
import { Producto, Variante } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { compararTalles, ordenarTalles } from '../../utils/talles.js';

/**
 * Opciones de visibilidad según quién consulta:
 * - `gestion` (admin): ve productos y variantes inactivos y el costo.
 * - sin gestión (secretaría): solo lo que se puede vender, y sin el costo.
 */
function serializar(producto, { gestion }) {
  const variantes = [...(producto.variantes ?? [])]
    .filter((v) => gestion || v.activo)
    .sort((a, b) => a.color.localeCompare(b.color, 'es') || compararTalles(a.talle, b.talle))
    .map(({ id, color, talle, stock, activo }) => ({ id, color, talle, stock, activo }));

  return {
    id: producto.id,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio_venta: producto.precio_venta,
    ...(gestion ? { costo: producto.costo } : {}),
    activo: producto.activo,
    stock_total: variantes.filter((v) => v.activo).reduce((acc, v) => acc + v.stock, 0),
    variantes,
  };
}

/**
 * Grilla color × talle para elegir la variante en pantalla:
 * { colores: [...], talles: [...], celdas: { [color]: { [talle]: { id, stock, activo } } } }
 */
function armarGrilla(variantes) {
  const colores = [...new Set(variantes.map((v) => v.color))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  );
  const talles = ordenarTalles([...new Set(variantes.map((v) => v.talle))]);
  const celdas = {};
  for (const { id, color, talle, stock, activo } of variantes) {
    celdas[color] ??= {};
    celdas[color][talle] = { id, stock, activo };
  }
  return { colores, talles, celdas };
}

/** 4.1 Listado con variantes y stock total. Filtros: búsqueda por nombre y activo. */
export async function listar({ q, activo } = {}, { gestion = false } = {}) {
  const where = {};
  if (q) where.nombre = { [Op.like]: `%${q.replace(/[\\%_]/g, '\\$&')}%` };
  // Quien no gestiona productos solo ve los que están a la venta.
  if (!gestion) where.activo = true;
  else if (activo !== undefined) where.activo = activo;

  const productos = await Producto.findAll({
    where,
    include: [{ model: Variante, as: 'variantes' }],
    order: [['nombre', 'ASC']],
  });
  return productos.map((p) => serializar(p, { gestion }));
}

export async function buscarProducto(id, opciones = {}) {
  const producto = await Producto.findByPk(id, {
    include: [{ model: Variante, as: 'variantes' }],
    ...opciones,
  });
  if (!producto) throw AppError.notFound('El producto no existe.', 'PRODUCTO_NO_ENCONTRADO');
  return producto;
}

/** 4.2 Detalle con las variantes y la grilla color × talle. */
export async function obtener(id, { gestion = false } = {}) {
  const producto = await buscarProducto(id);
  if (!gestion && !producto.activo) {
    throw AppError.notFound('El producto no existe.', 'PRODUCTO_NO_ENCONTRADO');
  }
  const datos = serializar(producto, { gestion });
  return { ...datos, grilla: armarGrilla(datos.variantes) };
}
