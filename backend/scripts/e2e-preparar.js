// Prepara la base de TEST para los E2E (frontend/e2e): migra, vacía todas las tablas y
// carga los datos de ejemplo del seeder. Nunca toca tienda_dev.
//   node scripts/e2e-preparar.js
process.env.NODE_ENV = 'test';

const { sequelize, connectDb, closeDb } = await import('../src/config/db.js');
const { env } = await import('../src/config/env.js');
const { createUmzug } = await import('../src/config/umzug.js');
const seeder = await import('../src/seeders/20261114-001-datos-iniciales.js');

try {
  if (!env.dbName.endsWith('_test')) throw new Error(`Base inesperada: ${env.dbName}`);
  await connectDb();
  await createUmzug('migrations', { logger: undefined }).up();

  const [tablas] = await sequelize.query(
    `SELECT TABLE_NAME AS nombre FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
  );
  await sequelize.transaction(async (transaction) => {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
    for (const { nombre } of tablas) {
      if (['sequelizemeta', 'sequelizedata'].includes(nombre.toLowerCase())) continue;
      await sequelize.query(`DELETE FROM \`${nombre}\``, { transaction });
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
  });

  await seeder.up();
  console.log(`Base ${env.dbName} lista para E2E.`);
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
