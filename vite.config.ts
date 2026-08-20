import { defineConfig } from 'vite';

export default defineConfig({
  // El deploy va a GitHub Pages, que sirve el sitio bajo /<repo>/.
  base: process.env['BASE_PATH'] ?? '/',
  worker: { format: 'es' },
  build: { target: 'es2022' },
});
