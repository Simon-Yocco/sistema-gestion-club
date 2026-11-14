import { sequelize } from '../../src/config/db.js';
import { env } from '../../src/config/env.js';

const TABLAS_DE_CONTROL = ['SequelizeMeta', 'SequelizeData'];

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
  const tablas = filas.map((f) => f.nombre).filter((t) => !TABLAS_DE_CONTROL.includes(t));
  if (tablas.length === 0) return;

  // Todo en la misma conexión: FOREIGN_KEY_CHECKS vale por sesión.
  await sequelize.transaction(async (transaction) => {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
    for (const tabla of tablas) {
      await sequelize.query(`TRUNCATE TABLE \`${tabla}\``, { transaction });
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
  });
}
