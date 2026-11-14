// 2.3 Variante = producto + talle + color. El stock vive acá y nunca es negativo (UNSIGNED).
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('variante', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    producto_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'producto', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    talle: { type: Sequelize.STRING(20), allowNull: false },
    color: { type: Sequelize.STRING(40), allowNull: false },
    stock: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
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

  await queryInterface.addIndex('variante', ['producto_id', 'talle', 'color'], {
    unique: true,
    name: 'uq_variante_producto_talle_color',
  });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('variante');
}
