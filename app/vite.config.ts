import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // publicDir is the default 'public/' — generated from data/ by `npm run data:sync`
  build: {
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing vendors into their own chunks:
        // cytoscape is ~400 kB on its own, so keeping it out of the app chunk
        // lets it download in parallel and stay cached across app deploys.
        // Vite 8's bundler (Rolldown) takes `manualChunks` as a function only;
        // the object shorthand from Rollup is no longer accepted.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/]cytoscape[\\/]/.test(id)) return 'cytoscape';
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.spec.ts'],
  },
});
