import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string;

// Project site path. GitHub Pages serves this repo at /starbud-island/.
export default defineConfig({
  base: '/starbud-island/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: { host: '0.0.0.0', port: 43123, strictPort: true },
  preview: { host: '0.0.0.0', port: 43124, strictPort: true },
  build: { outDir: 'dist', assetsDir: 'assets', emptyOutDir: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
