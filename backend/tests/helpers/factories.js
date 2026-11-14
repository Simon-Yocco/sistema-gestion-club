// Fábricas de datos de prueba. Cada una acepta overrides y devuelve la instancia creada.
import { Usuario, Producto, Variante, Comprador } from '../../src/models/index.js';
import { hashPassword } from '../../src/modules/auth/password.js';

let secuencia = 0;
const siguiente = () => ++secuencia;

/** Contraseña de todos los usuarios de test, salvo que se pase otra. */
export const PASSWORD_TEST = 'clave-de-test';

export async function crearUsuario({ password = PASSWORD_TEST, ...overrides } = {}) {
  const n = siguiente();
  return Usuario.create({
    nombre: `Usuario ${n}`,
    username: `usuario${n}`,
    password_hash: await hashPassword(password),
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

/** Por defecto con teléfono (puede llevar fiado) y sin número de socio, como en el club. */
export async function crearComprador(overrides = {}) {
  const n = siguiente();
  return Comprador.create({
    nombre: `Comprador ${n}`,
    apodo: null,
    numero_socio: null,
    telefono: `11 4000-${String(n).padStart(4, '0')}`,
    ...overrides,
  });
}
