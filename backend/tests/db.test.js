import { describe, it, expect } from 'vitest';
import { connectDb, sequelize } from '../src/config/db.js';
import { truncateAll } from './helpers/db.js';

describe('base de datos de test', () => {
  it('se conecta a la base de test', async () => {
    const db = await connectDb();
    expect(db.database).toBe(process.env.DB_NAME_TEST ?? 'tienda_test');
  });

  it('las migraciones se aplicaron antes de la suite (existe SequelizeMeta)', async () => {
    const [filas] = await sequelize.query(
      `SELECT COUNT(*) AS n FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SequelizeMeta'`,
    );
    expect(Number(filas[0].n)).toBe(1);
  });

  it('truncateAll() deja las tablas vacías', async () => {
    await sequelize.query('CREATE TABLE IF NOT EXISTS tmp_prueba (id INT PRIMARY KEY)');
    try {
      await sequelize.query('INSERT INTO tmp_prueba VALUES (1), (2)');
      await truncateAll();
      const [filas] = await sequelize.query('SELECT COUNT(*) AS n FROM tmp_prueba');
      expect(Number(filas[0].n)).toBe(0);
    } finally {
      await sequelize.query('DROP TABLE tmp_prueba');
    }
  });
});
