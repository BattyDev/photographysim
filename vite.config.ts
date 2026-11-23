import { defineConfig } from 'vite';

export default defineConfig({
  base: '/photographysim/',
  build: {
    // three.js alone is ~600 kB minified; it's one cached download.
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: 5174,
  },
});
