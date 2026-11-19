import { defineConfig } from 'vitest/config';
export default defineConfig({
  clearScreen: false,
  server: { host: '127.0.0.1', port: 1420, strictPort: true },
  preview: { host: '127.0.0.1', port: 1420, strictPort: true },
  test: { include: ['test/**/*.unit.test.ts'], environment: 'node' },
  build: { target: 'es2022' },
});
