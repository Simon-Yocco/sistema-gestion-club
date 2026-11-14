import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Carga backend/.env sin importar desde qué carpeta se ejecute el proceso.
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(backendDir, '.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1, 'falta DB_USER'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1, 'falta DB_NAME'),
  DB_NAME_TEST: z.string().min(1, 'falta DB_NAME_TEST'),

  JWT_SECRET: z.string().default(''),
  JWT_EXPIRES_IN: z.string().default('8h'),

  TZ_DISPLAY: z.string().default('America/Argentina/Buenos_Aires'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const detalle = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(
    `Configuración inválida en backend/.env (copiar desde .env.example):\n${detalle}`,
  );
}

const vars = parsed.data;

if (vars.NODE_ENV === 'production' && vars.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
}

export const env = {
  ...vars,
  isTest: vars.NODE_ENV === 'test',
  isProduction: vars.NODE_ENV === 'production',
  /** Base a usar: en tests siempre la de test, para no tocar datos de desarrollo. */
  dbName: vars.NODE_ENV === 'test' ? vars.DB_NAME_TEST : vars.DB_NAME,
};
