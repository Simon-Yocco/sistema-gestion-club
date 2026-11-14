// 9.2 Cambio sin venta registrada: la prenda devuelta se toma como CRÉDITO en la venta nueva.
// Ese crédito no es dinero que entra (no genera movimiento de fondos) ni tiene medio de pago,
// pero cuenta como pagado para que la venta nueva no quede con deuda.
//   pago.tipo  += 'credito_cambio'
//   pago.medio  pasa a admitir NULL (solo para créditos)
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.sequelize.query('ALTER TABLE pago DROP CHECK chk_pago_signo');
  await queryInterface.changeColumn('pago', 'tipo', {
    type: Sequelize.ENUM('cobro', 'devolucion', 'credito_cambio'),
    allowNull: false,
  });
  await queryInterface.changeColumn('pago', 'medio', {
    type: Sequelize.ENUM('efectivo', 'transferencia'),
    allowNull: true,
  });
  await queryInterface.sequelize.query(
    `ALTER TABLE pago ADD CONSTRAINT chk_pago_signo CHECK (
       (tipo = 'cobro' AND monto > 0 AND medio IS NOT NULL)
       OR (tipo = 'devolucion' AND monto < 0 AND medio IS NOT NULL)
       OR (tipo = 'credito_cambio' AND monto > 0 AND medio IS NULL)
     )`,
  );
}

export async function down({ context: { queryInterface, Sequelize } }) {
  await queryInterface.sequelize.query('ALTER TABLE pago DROP CHECK chk_pago_signo');
  await queryInterface.changeColumn('pago', 'medio', {
    type: Sequelize.ENUM('efectivo', 'transferencia'),
    allowNull: false,
  });
  await queryInterface.changeColumn('pago', 'tipo', {
    type: Sequelize.ENUM('cobro', 'devolucion'),
    allowNull: false,
  });
  await queryInterface.sequelize.query(
    `ALTER TABLE pago ADD CONSTRAINT chk_pago_signo CHECK (
       (tipo = 'cobro' AND monto > 0) OR (tipo = 'devolucion' AND monto < 0)
     )`,
  );
}
