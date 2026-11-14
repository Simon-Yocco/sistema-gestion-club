// 15.1 Tests E2E con Playwright: la app completa (backend + frontend) en un navegador real.
// Usan la base tienda_test (se vacía y se carga con el seeder antes de correr) y puertos
// propios (API 3100, frontend 5174), así no chocan con el entorno de desarrollo.
// Usan el Chrome instalado en la máquina: no hace falta descargar navegadores.
//   npm run e2e
import { defineConfig, devices } from '@playwright/test';

const API = 'http://localhost:3100';
const WEB = 'http://localhost:5174';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/preparar.js',
  fullyParallel: false,
  workers: 1, // comparten la base: de a uno
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: WEB,
    channel: 'chrome',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'escritorio',
      testMatch: /flujos\.spec\.js/,
      use: { viewport: { width: 1280, height: 800 } },
    },
    // 15.5 Celular: pantalla chica y táctil.
    {
      name: 'celular',
      testMatch: /celular\.spec\.js/,
      use: { ...devices['Pixel 7'], channel: 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'node src/server.js',
      cwd: '../backend',
      url: `${API}/api/health`,
      env: { NODE_ENV: 'test', PORT: '3100' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: WEB,
      env: { VITE_PROXY_API: API },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
