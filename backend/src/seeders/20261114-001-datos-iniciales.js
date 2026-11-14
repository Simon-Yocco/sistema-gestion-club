// 2.15 Datos de ejemplo para DESARROLLO (nunca en producción: scripts/seed.js lo impide).
//
// Usuarios (contraseñas solo de desarrollo):
//   admin       / admin1234        rol admin
//   secretaria  / secretaria1234   rol secretaria
//
// El stock no se carga directo: entra por un ingreso de mercadería, igual que en la vida
// real, para que se cumpla stock = ingresos − vendidos + devueltos.
import bcrypt from 'bcryptjs';
import {
  sequelize,
  Usuario,
  Producto,
  Variante,
  IngresoMercaderia,
  IngresoItem,
} from '../models/index.js';

const USUARIOS = [
  { nombre: 'Administrador', username: 'admin', password: 'admin1234', rol: 'admin' },
  { nombre: 'Secretaría', username: 'secretaria', password: 'secretaria1234', rol: 'secretaria' },
];

const PRODUCTOS = [
  {
    nombre: 'Remera titular',
    descripcion: 'Remera oficial del club',
    precio_venta: '15000.00',
    costo: '8000.00',
    colores: ['Blanca', 'Azul'],
    talles: ['S', 'M', 'L', 'XL'],
    stock: { S: 3, M: 6, L: 6, XL: 2 },
  },
  {
    nombre: 'Short de entrenamiento',
    descripcion: null,
    precio_venta: '9000.00',
    costo: '4500.00',
    colores: ['Negro'],
    talles: ['S', 'M', 'L'],
    stock: { S: 4, M: 5, L: 0 },
  },
  {
    nombre: 'Buzo con capucha',
    descripcion: 'Buzo de algodón con escudo bordado',
    precio_venta: '35000.00',
    costo: '20000.00',
    colores: ['Azul', 'Gris'],
    talles: ['M', 'L'],
    stock: { M: 2, L: 1 },
  },
];

export async function up() {
  await sequelize.transaction(async (transaction) => {
    const usuarios = [];
    for (const { password, ...datos } of USUARIOS) {
      const password_hash = await bcrypt.hash(password, 10);
      usuarios.push(await Usuario.create({ ...datos, password_hash }, { transaction }));
    }
    const admin = usuarios.find((u) => u.rol === 'admin');

    const ingreso = await IngresoMercaderia.create(
      {
        fecha: new Date().toISOString().slice(0, 10),
        proveedor: 'Proveedor de ejemplo',
        observaciones: 'Stock inicial de ejemplo (seeder)',
        usuario_id: admin.id,
      },
      { transaction },
    );

    for (const { colores, talles, stock, ...datos } of PRODUCTOS) {
      const producto = await Producto.create(datos, { transaction });
      for (const color of colores) {
        for (const talle of talles) {
          const cantidad = stock[talle];
          const variante = await Variante.create(
            { producto_id: producto.id, color, talle, stock: cantidad },
            { transaction },
          );
          if (cantidad > 0) {
            await IngresoItem.create(
              {
                ingreso_id: ingreso.id,
                variante_id: variante.id,
                cantidad,
                costo_unitario: producto.costo,
              },
              { transaction },
            );
          }
        }
      }
    }
  });
}

export async function down() {
  await sequelize.transaction(async (transaction) => {
    const productos = await Producto.findAll({
      where: { nombre: PRODUCTOS.map((p) => p.nombre) },
      transaction,
    });
    const variantes = await Variante.findAll({
      where: { producto_id: productos.map((p) => p.id) },
      transaction,
    });
    const ingresos = await IngresoMercaderia.findAll({
      where: { observaciones: 'Stock inicial de ejemplo (seeder)' },
      transaction,
    });
    await IngresoItem.destroy({ where: { ingreso_id: ingresos.map((i) => i.id) }, transaction });
    await IngresoMercaderia.destroy({ where: { id: ingresos.map((i) => i.id) }, transaction });
    await Variante.destroy({ where: { id: variantes.map((v) => v.id) }, transaction });
    await Producto.destroy({ where: { id: productos.map((p) => p.id) }, transaction });
    await Usuario.destroy({ where: { username: USUARIOS.map((u) => u.username) }, transaction });
  });
}
