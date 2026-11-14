// 2.11 Cambios de prenda (regla 9). venta_id y venta_item_devuelto_id son NULL en los
// cambios sin venta registrada; en ese caso la prenda devuelta se valúa al precio actual.
export async function up({ context: { queryInterface, Sequelize } }) {
  const fk = (tabla, allowNull = false) => ({
    type: Sequelize.INTEGER.UNSIGNED,
    allowNull,
    references: { model: tabla, key: 'id' },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT',
  });

  await queryInterface.createTable('cambio', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    venta_id: fk('venta', true),
    venta_item_devuelto_id: fk('venta_item', true),
    variante_devuelta_id: fk('variante'),
    cantidad_devuelta: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
    valor_devuelto: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    venta_item_nuevo_id: fk('venta_item'),
    cantidad_nueva: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
    valor_nuevo: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    // diferencia = valor_nuevo − valor_devuelto (positiva: el cliente paga; negativa: se le devuelve)
    diferencia: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
    resolucion: {
      type: Sequelize.ENUM('sin_diferencia', 'cobro', 'devolucion', 'ajuste_deuda'),
      allowNull: false,
    },
    motivo: { type: Sequelize.TEXT, allowNull: true },
    fecha: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    usuario_id: fk('usuario'),
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.sequelize.query(
    `ALTER TABLE cambio ADD CONSTRAINT chk_cambio CHECK (
       cantidad_devuelta > 0
       AND cantidad_nueva > 0
       AND valor_devuelto >= 0
       AND valor_nuevo >= 0
       AND diferencia = valor_nuevo - valor_devuelto
     )`,
  );
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('cambio');
}
