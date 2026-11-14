import { Sequelize } from 'sequelize';
import { env } from './env.js';

export const sequelize = new Sequelize(env.dbName, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'mysql',
  // Las fechas se guardan en UTC; el frontend las muestra en hora de Argentina.
  timezone: '+00:00',
  logging: false,
  define: {
    underscored: true,
    freezeTableName: true,
  },
  // DECIMAL llega como string ("15000.00"): se convierte a centavos con utils/money.js.
  dialectOptions: { decimalNumbers: false },
});

/**
 * Verifica la conexión. Si falla, lanza un error con un mensaje claro
 * que indica qué revisar.
 */
export async function connectDb() {
  try {
    await sequelize.authenticate();
  } catch (err) {
    const destino = `${env.DB_USER}@${env.DB_HOST}:${env.DB_PORT}/${env.dbName}`;
    throw new Error(
      `No se pudo conectar a MySQL (${destino}): ${err.message}\n` +
        'Revisá que MySQL esté corriendo, que la base exista (backend/db/init.sql) ' +
        'y los datos DB_* de backend/.env.',
      { cause: err },
    );
  }
  return { database: env.dbName, host: env.DB_HOST, port: env.DB_PORT };
}

export async function closeDb() {
  await sequelize.close();
}
