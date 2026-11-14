# Migraciones

Una migración por tabla (o por cambio), con nombre `AAAAMMDD-NNN-descripcion.js` para que se ordenen solas.
Se ejecutan con `npm run migrate` (base de desarrollo). La base de test se migra sola al correr `npm test`.

```js
export async function up({ context: { queryInterface, Sequelize } }) {
  await queryInterface.createTable('ejemplo', {
    id: { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
  });
}

export async function down({ context: { queryInterface } }) {
  await queryInterface.dropTable('ejemplo');
}
```

Comandos: `npm run migrate` (aplica las pendientes), `npm run migrate:down` (revierte la última), `npm run migrate:status`.
