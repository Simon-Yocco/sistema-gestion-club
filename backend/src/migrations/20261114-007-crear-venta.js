// 2.7 Venta (cabecera). El total, lo pagado, la deuda y el estado de pago NO se guardan:
// se calculan a partir de venta_item y pago (principio 6).
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('venta', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    fecha: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    comprador_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'comprador', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    usuario_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'usuario', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    estado: {
      type: Sequelize.ENUM('activa', 'anulada'),
      allowNull: false,
      defaultValue: 'activa',
    },
    motivo_anulacion: { type: Sequelize.TEXT, allowNull: true },
    anulada_por: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'usuario', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    anulada_at: { type: Sequelize.DATE, allowNull: true },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.addIndex('venta', ['fecha'], { name: 'idx_venta_fecha' });
  await queryInterface.addIndex('venta', ['estado'], { name: 'idx_venta_estado' });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('venta');
}
