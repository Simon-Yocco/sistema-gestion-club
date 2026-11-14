// 2.1 Usuarios del sistema (secretaría y administrador). No se borran: se desactivan.
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('usuario', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    nombre: { type: Sequelize.STRING(100), allowNull: false },
    username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
    password_hash: { type: Sequelize.STRING(100), allowNull: false },
    rol: { type: Sequelize.ENUM('secretaria', 'admin'), allowNull: false },
    activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
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
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('usuario');
}
