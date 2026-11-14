import { describe, it, expect, afterAll } from 'vitest';
import { connectDb, closeDb } from '../src/config/db.js';

describe('conexión a MySQL', () => {
  afterAll(closeDb);

  it('en tests se conecta a la base de test', async () => {
    const db = await connectDb();
    expect(db.database).toBe(process.env.DB_NAME_TEST ?? 'tienda_test');
  });
});
