import { sequelize } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';

// En minúsculas: en Windows MySQL guarda los nombres de tabla en minúsculas (lower_case_table_names=1).
const TABLAS_DE_CONTROL = ['sequelizemeta', 'sequelizedata'];

/**
 * Vacía todas las tablas de la base de test (menos las de control de migraciones).
 * Se niega a correr si la base no termina en "_test", para no borrar datos reales.
 */
export async function truncateAll() {
  if (!env.dbName.endsWith('_test')) {
    throw new Error(`truncateAll() solo corre sobre una base *_test (actual: ${env.dbName})`);
  }

  const [filas] = await sequelize.query(
    `SELECT TABLE_NAME AS nombre FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`,
  );
  const tablas = filas
    .map((f) => f.nombre)
    .filter((t) => !TABLAS_DE_CONTROL.includes(t.toLowerCase()));
  if (tablas.length === 0) return;

  // DELETE y no TRUNCATE: en InnoDB, TRUNCATE recrea la tabla (~50 ms cada una) y con
  // ~17 tablas antes de cada test hacía la suite muy lenta. Los tests no dependen de los ids.
  // Todo en la misma conexión: FOREIGN_KEY_CHECKS vale por sesión.
  await sequelize.transaction(async (transaction) => {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
    for (const tabla of tablas) {
      await sequelize.query(`DELETE FROM \`${tabla}\``, { transaction });
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
  });
}
