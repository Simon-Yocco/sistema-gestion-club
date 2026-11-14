// Corre en cada archivo de test: base limpia antes de cada test y cierre de conexiones al final.
import { beforeEach, afterAll } from 'vitest';
import { truncateAll } from '../helpers/db.js';
import { closeDb } from '../../src/config/db.js';

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeDb();
});
