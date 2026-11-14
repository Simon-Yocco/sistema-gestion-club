// Antes de los E2E: deja la base de test vacía y con los datos del seeder.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend');

export default function preparar() {
  execFileSync(process.execPath, ['scripts/e2e-preparar.js'], { cwd: backend, stdio: 'inherit' });
}
