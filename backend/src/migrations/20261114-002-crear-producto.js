// 2.2 Producto (la prenda). Precio de venta y costo son únicos por producto (reglas 3.1 y 3.2).
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('producto', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    nombre: { type: Sequelize.STRING(100), allowNull: false, unique: true },
    descripcion: { type: Sequelize.TEXT, allowNull: true },
    precio_venta: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    costo: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.sequelize.query(
    'ALTER TABLE producto ADD CONSTRAINT chk_producto_montos CHECK (precio_venta >= 0 AND costo >= 0)',
  );
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('producto');
}
