import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    fs: {
      deny: ['**/.env*', '**/server/**', '**/tests/**', '**/PLAN.md', '**/PRD.md', '**/dist-server/**'],
    },
  },
  build: { target: 'es2022', sourcemap: false },
});
