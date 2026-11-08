import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  base: process.env.BASE_PATH || '/',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { host: '0.0.0.0' }
});
