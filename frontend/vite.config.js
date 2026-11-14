import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se reenvía al backend (puerto 3000). Así el navegador ve un solo
// origen y la cookie de sesión funciona sin configurar CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // VITE_PROXY_API permite apuntar a otro backend (los E2E usan el puerto 3100).
    proxy: { '/api': process.env.VITE_PROXY_API ?? 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.js'],
    css: false,
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
