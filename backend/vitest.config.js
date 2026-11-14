import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    globalSetup: ['tests/setup/globalSetup.js'],
    setupFiles: ['tests/setup/setupEach.js'],
    // Todos los tests comparten la base tienda_test: un archivo a la vez.
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 15000,
  },
});
