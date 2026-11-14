// Corre una vez antes de toda la suite: aplica las migraciones en la base de test.
export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  const { connectDb, closeDb } = await import('../../src/config/db.js');
  const { createUmzug } = await import('../../src/config/umzug.js');

  try {
    await connectDb();
    await createUmzug('migrations', { logger: undefined }).up();
  } finally {
    await closeDb();
  }
}
