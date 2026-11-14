// 2.9 Pagos de una venta: cobros (monto > 0) y devoluciones de dinero (monto < 0).
// Pagado neto de la venta = SUM(monto).
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('pago', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    venta_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'venta', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    medio: { type: Sequelize.ENUM('efectivo', 'transferencia'), allowNull: false },
    monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    tipo: { type: Sequelize.ENUM('cobro', 'devolucion'), allowNull: false },
    fecha: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
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

  await queryInterface.sequelize.query(
    `ALTER TABLE pago ADD CONSTRAINT chk_pago_signo CHECK (
       (tipo = 'cobro' AND monto > 0) OR (tipo = 'devolucion' AND monto < 0)
     )`,
  );
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('pago');
}
