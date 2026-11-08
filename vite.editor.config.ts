import { defineConfig } from 'vite';

// This tool is intentionally separate from the game and listens only on localhost.
export default defineConfig({
  root: 'editor',
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  build: { outDir: '../dist-editor', emptyOutDir: true },
});
