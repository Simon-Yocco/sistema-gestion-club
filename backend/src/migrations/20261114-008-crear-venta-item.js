// 2.8 Ítems de venta con precio y costo congelados (principio 7).
// origen = 'cambio' marca los ítems agregados a la venta por un cambio de prenda.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('venta_item', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    venta_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'venta', key: 'id' },
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
    precio_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    costo_unitario: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    cantidad_devuelta: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    origen: {
      type: Sequelize.ENUM('venta', 'cambio'),
      allowNull: false,
      defaultValue: 'venta',
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.sequelize.query(
    `ALTER TABLE venta_item ADD CONSTRAINT chk_venta_item CHECK (
       cantidad > 0
       AND cantidad_devuelta <= cantidad
       AND precio_unitario >= 0
       AND costo_unitario >= 0
     )`,
  );
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('venta_item');
}
