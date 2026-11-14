// 2.13 Depósitos (efectivo → banco) y extracciones (banco → efectivo) (regla 11.2).
// Cada registro genera dos movimientos de fondos del mismo monto con signos opuestos.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('transferencia_medios', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    fecha: { type: Sequelize.DATEONLY, allowNull: false },
    tipo: { type: Sequelize.ENUM('deposito', 'extraccion'), allowNull: false },
    monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    descripcion: { type: Sequelize.TEXT, allowNull: true },
    comprobante: { type: Sequelize.STRING(50), allowNull: true },
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
    'ALTER TABLE transferencia_medios ADD CONSTRAINT chk_transferencia_medios_monto CHECK (monto > 0)',
  );
  await queryInterface.addIndex('transferencia_medios', ['fecha'], {
    name: 'idx_transferencia_medios_fecha',
  });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('transferencia_medios');
}
