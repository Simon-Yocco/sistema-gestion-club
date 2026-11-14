// 2.5 Ingreso de mercadería (cabecera). No mueve dinero: el pago al proveedor es un egreso.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('ingreso_mercaderia', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    fecha: { type: Sequelize.DATEONLY, allowNull: false },
    proveedor: { type: Sequelize.STRING(100), allowNull: true },
    observaciones: { type: Sequelize.TEXT, allowNull: true },
    usuario_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'usuario', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.addIndex('ingreso_mercaderia', ['fecha'], {
    name: 'idx_ingreso_mercaderia_fecha',
  });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('ingreso_mercaderia');
}
