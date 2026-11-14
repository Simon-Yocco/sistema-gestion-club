// Productos y variantes (reglas, sección 3).
import { Op, UniqueConstraintError } from 'sequelize';
import { sequelize, Producto, Variante } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { fromCents } from '../../utils/money.js';
import {
  compararTalles,
  ordenarTalles,
  normalizarColor,
  normalizarTalle,
  claveTexto,
} from '../../utils/talles.js';

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

// ---------------------------------------------------------------- Alta y edición (admin)

/**
 * Normaliza una lista de colores o talles y rechaza repetidos. Se comparan sin mayúsculas
 * ni acentos, igual que el índice único de la base ("Azul" = "azul" = "Azúl").
 */
function normalizarLista(valores, normalizar, campo) {
  const vistos = new Map();
  for (const valor of valores.map(normalizar)) {
    const clave = claveTexto(valor);
    if (vistos.has(clave)) {
      throw AppError.badRequest('VARIANTE_DUPLICADA', `Hay ${campo} repetidos: "${valor}".`, {
        campo,
        valor,
      });
    }
    vistos.set(clave, valor);
  }
  return [...vistos.values()];
}

/** Traduce el nombre de producto repetido a un 409 legible. */
async function guardando(operacion) {
  try {
    return await operacion();
  } catch (err) {
    if (err instanceof UniqueConstraintError && err.fields?.nombre !== undefined) {
      throw AppError.conflict('PRODUCTO_DUPLICADO', 'Ya existe un producto con ese nombre.');
    }
    if (err instanceof UniqueConstraintError) {
      throw AppError.conflict('VARIANTE_DUPLICADA', 'Esa variante (color y talle) ya existe.');
    }
    throw err;
  }
}

/**
 * 4.3 Crea un producto con la grilla de variantes colores × talles, todas con stock 0
 * (el stock entra por ingreso de mercadería). Precio y costo llegan en centavos.
 */
export async function crear({ nombre, descripcion, precio_venta, costo, colores, talles }) {
  const listaColores = normalizarLista(colores, normalizarColor, 'colores');
  const listaTalles = normalizarLista(talles, normalizarTalle, 'talles');

  const id = await guardando(() =>
    sequelize.transaction(async (transaction) => {
      const producto = await Producto.create(
        { nombre, descripcion, precio_venta: fromCents(precio_venta), costo: fromCents(costo) },
        { transaction },
      );
      await Variante.bulkCreate(
        listaColores.flatMap((color) =>
          listaTalles.map((talle) => ({ producto_id: producto.id, color, talle, stock: 0 })),
        ),
        { transaction },
      );
      return producto.id;
    }),
  );

  return obtener(id, { gestion: true });
}

/**
 * 4.4 Edita nombre, descripción, precio o costo. El precio es único por producto, así que
 * un cambio afecta a todas sus variantes a la vez (regla 3.1). No toca ventas ya hechas:
 * cada venta_item guarda su precio y costo congelados. El costo nuevo rige para los
 * ingresos y ventas siguientes (regla 3.2).
 */
export async function editar(id, cambios) {
  const producto = await buscarProducto(id);
  const datos = { ...cambios };
  if (datos.precio_venta !== undefined) datos.precio_venta = fromCents(datos.precio_venta);
  if (datos.costo !== undefined) datos.costo = fromCents(datos.costo);

  await guardando(() => producto.update(datos));
  return obtener(id, { gestion: true });
}
