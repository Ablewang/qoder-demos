import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: Number(process.env.FRONTEND_PORT ?? 5217),
    strictPort: true,
    fs: {
      allow: ['src', 'node_modules'],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local-data/**', '**/server/**', '**/scripts/**', '**/tests/**', '**/artifacts/**', '**/PLAN.md', '**/PRD.md'],
    },
    proxy: { '/api': { target: `http://127.0.0.1:${process.env.BACKEND_PORT ?? 5218}`, changeOrigin: true } },
  },
});
