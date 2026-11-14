// Uso: npm run seed. Aplica los seeders pendientes (solo en desarrollo).
import { env } from '../src/config/env.js';
import { createUmzug } from '../src/config/umzug.js';
import { connectDb, closeDb } from '../src/config/db.js';

try {
  if (env.isProduction) throw new Error('Los seeders de ejemplo no se corren en producción.');
  const { database } = await connectDb();
  console.log(`Base: ${database}`);
  const hechos = await createUmzug('seeders').up();
  console.log(hechos.length ? `Seeders aplicados: ${hechos.length}` : 'No hay seeders pendientes.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
