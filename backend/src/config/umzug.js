import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from './db.js';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TIPOS = {
  migrations: { dir: path.join(srcDir, 'migrations'), tabla: 'SequelizeMeta' },
  seeders: { dir: path.join(srcDir, 'seeders'), tabla: 'SequelizeData' },
};

/**
 * Lee los archivos .js de la carpeta, ordenados por nombre
 * (por eso se nombran con prefijo de fecha: 20261114-001-crear-usuario.js).
 * Cada archivo exporta `up` y `down`, que reciben { context: { queryInterface, Sequelize } }.
 */
function cargarArchivos(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((archivo) => {
      const url = pathToFileURL(path.join(dir, archivo)).href;
      return {
        name: archivo,
        up: async (params) => (await import(url)).up(params),
        down: async (params) => {
          const mod = await import(url);
          if (!mod.down) throw new Error(`${archivo} no define down()`);
          return mod.down(params);
        },
      };
    });
}

/** @param {'migrations' | 'seeders'} tipo */
export function createUmzug(tipo = 'migrations', { logger = console } = {}) {
  const { dir, tabla } = TIPOS[tipo];
  return new Umzug({
    migrations: cargarArchivos(dir),
    context: { queryInterface: sequelize.getQueryInterface(), Sequelize },
    storage: new SequelizeStorage({ sequelize, tableName: tabla }),
    logger,
  });
}
