// Fábricas de datos de prueba. Cada una acepta overrides y devuelve la instancia creada.
import { Usuario, Producto, Variante, Comprador } from '../../src/models/index.js';

let secuencia = 0;
const siguiente = () => ++secuencia;

/** Hash que no corresponde a ninguna contraseña: para tests que no hacen login. */
export const HASH_FALSO = '$2b$10$hashfalsohashfalsohashfalsohashfalsohashfalsohashfa';

export async function crearUsuario(overrides = {}) {
  const n = siguiente();
  return Usuario.create({
    nombre: `Usuario ${n}`,
    username: `usuario${n}`,
    password_hash: HASH_FALSO,
    rol: 'secretaria',
    ...overrides,
  });
}

export const crearAdmin = (overrides = {}) => crearUsuario({ rol: 'admin', ...overrides });

/**
 * Crea un producto con la grilla de variantes colores × talles.
 * `stock` es el stock inicial de cada variante.
 *
 *   const { producto, variantes } = await crearProductoConVariantes({ precio_venta: '15000.00' });
 */
export async function crearProductoConVariantes({
  colores = ['Blanca', 'Azul'],
  talles = ['M', 'L'],
  stock = 10,
  ...overrides
} = {}) {
  const n = siguiente();
  const producto = await Producto.create({
    nombre: `Producto ${n}`,
    precio_venta: '15000.00',
    costo: '8000.00',
    ...overrides,
  });
  const variantes = await Variante.bulkCreate(
    colores.flatMap((color) =>
      talles.map((talle) => ({ producto_id: producto.id, color, talle, stock })),
    ),
  );
  return { producto, variantes };
}

export async function crearComprador(overrides = {}) {
  const n = siguiente();
  return Comprador.create({
    nombre: `Comprador ${n}`,
    numero_socio: `S${n}`,
    telefono: null,
    ...overrides,
  });
}
