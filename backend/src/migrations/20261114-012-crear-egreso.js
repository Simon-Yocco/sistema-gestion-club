// 2.12 Egresos: pagos que hace la tienda desde secretaría (regla 12). Monto siempre positivo;
// el movimiento de fondos asociado es el que lleva el signo negativo.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('egreso', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    fecha: { type: Sequelize.DATEONLY, allowNull: false },
    monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    medio: { type: Sequelize.ENUM('efectivo', 'transferencia'), allowNull: false },
    concepto: { type: Sequelize.ENUM('mercaderia', 'otro'), allowNull: false },
    descripcion: { type: Sequelize.TEXT, allowNull: true },
    comprobante: { type: Sequelize.STRING(50), allowNull: true },
    ingreso_mercaderia_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'ingreso_mercaderia', key: 'id' },
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
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.sequelize.query(
    'ALTER TABLE egreso ADD CONSTRAINT chk_egreso_monto CHECK (monto > 0)',
  );
  await queryInterface.addIndex('egreso', ['fecha'], { name: 'idx_egreso_fecha' });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('egreso');
}
