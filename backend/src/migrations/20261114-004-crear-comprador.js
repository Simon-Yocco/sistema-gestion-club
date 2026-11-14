// 2.4 Comprador. Para fiado debe ser identificable (socio o teléfono): se valida en el service.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('comprador', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    nombre: { type: Sequelize.STRING(100), allowNull: false },
    // UNIQUE admite varios NULL en MySQL: solo es único si se carga.
    numero_socio: { type: Sequelize.STRING(20), allowNull: true, unique: true },
    telefono: { type: Sequelize.STRING(30), allowNull: true },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.addIndex('comprador', ['nombre'], { name: 'idx_comprador_nombre' });
  await queryInterface.addIndex('comprador', ['telefono'], { name: 'idx_comprador_telefono' });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('comprador');
}
