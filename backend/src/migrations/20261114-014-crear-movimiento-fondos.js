// 2.13b Libro de movimientos de fondos. El saldo por medio es SUM(monto) (principio 5):
// nunca se guarda ni se edita a mano. Los préstamos de la comisión directiva solo existen acá.
export const TIPOS_MOVIMIENTO = [
  'cobro_venta',
  'cobro_fiado',
  'cobro_diferencia_cambio',
  'devolucion_diferencia_cambio',
  'devolucion_anulacion',
  'egreso',
  'prestamo_recibido',
  'devolucion_prestamo',
  'deposito_bancario',
  'extraccion_bancaria',
  // Dinero con el que arranca la tienda al empezar a usar el sistema (tarea 17.2).
  'saldo_inicial',
];

export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('movimiento_fondos', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    fecha: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    medio: { type: Sequelize.ENUM('efectivo', 'transferencia'), allowNull: false },
    monto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    tipo: { type: Sequelize.ENUM(...TIPOS_MOVIMIENTO), allowNull: false },
    // Operación que originó el movimiento (pago, egreso, transferencia_medios, ...).
    referencia_tipo: { type: Sequelize.STRING(40), allowNull: true },
    referencia_id: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
    descripcion: { type: Sequelize.STRING(255), allowNull: true },
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
    'ALTER TABLE movimiento_fondos ADD CONSTRAINT chk_movimiento_monto CHECK (monto <> 0)',
  );
  await queryInterface.addIndex('movimiento_fondos', ['medio'], { name: 'idx_movimiento_medio' });
  await queryInterface.addIndex('movimiento_fondos', ['fecha'], { name: 'idx_movimiento_fecha' });
  await queryInterface.addIndex('movimiento_fondos', ['referencia_tipo', 'referencia_id'], {
    name: 'idx_movimiento_referencia',
  });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('movimiento_fondos');
}
