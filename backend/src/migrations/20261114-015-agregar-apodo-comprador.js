// Reglas v1.2: en el club los compradores se conocen por nombre o apodo (no por número de
// socio). Se agrega el apodo, que también se usa para buscar y distinguir homónimos.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.addColumn('comprador', 'apodo', {
    type: Sequelize.STRING(60),
    allowNull: true,
    after: 'nombre',
  });
  await queryInterface.addIndex('comprador', ['apodo'], { name: 'idx_comprador_apodo' });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.removeIndex('comprador', 'idx_comprador_apodo');
  await queryInterface.removeColumn('comprador', 'apodo');
}
