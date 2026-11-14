import { defineConfig } from 'vitest/config';

// Project site path. GitHub Pages serves this repo at /starbud-island/.
export default defineConfig({
  base: '/starbud-island/',
  server: { host: '0.0.0.0', port: 43123, strictPort: true },
  preview: { host: '0.0.0.0', port: 43124, strictPort: true },
  build: { outDir: 'dist', assetsDir: 'assets', emptyOutDir: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
