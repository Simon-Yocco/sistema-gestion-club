// 2.6 Ítems del ingreso. El costo unitario se copia del producto al momento del ingreso.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('ingreso_item', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    ingreso_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'ingreso_mercaderia', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    variante_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'variante', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    cantidad: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
    costo_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.sequelize.query(
    'ALTER TABLE ingreso_item ADD CONSTRAINT chk_ingreso_item CHECK (cantidad > 0 AND costo_unitario >= 0)',
  );
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('ingreso_item');
}
