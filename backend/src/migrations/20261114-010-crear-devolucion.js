// 2.10 Devoluciones (parciales) y anulaciones (totales) de una venta, con motivo obligatorio.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('devolucion', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    venta_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'venta', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    // Distingue en el reporte 11.5 una devolución parcial de una anulación total.
    tipo: {
      type: Sequelize.ENUM('devolucion', 'anulacion'),
      allowNull: false,
      defaultValue: 'devolucion',
    },
    motivo: { type: Sequelize.TEXT, allowNull: false },
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
    "ALTER TABLE devolucion ADD CONSTRAINT chk_devolucion_motivo CHECK (TRIM(motivo) <> '')",
  );

  await queryInterface.createTable('devolucion_item', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    devolucion_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'devolucion', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    venta_item_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'venta_item', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    },
    cantidad: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.sequelize.query(
    'ALTER TABLE devolucion_item ADD CONSTRAINT chk_devolucion_item_cantidad CHECK (cantidad > 0)',
  );
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('devolucion_item');
  await queryInterface.dropTable('devolucion');
}
