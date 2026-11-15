// Reglas v1.4: el producto tiene marca (opcional). Los talles y colores ya no se definen al
// crearlo: aparecen al ingresar mercadería.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.addColumn('producto', 'marca', {
    type: Sequelize.STRING(60),
    allowNull: true,
    after: 'descripcion',
  });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.removeColumn('producto', 'marca');
}
