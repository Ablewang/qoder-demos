import { defineConfig } from 'vite';

const proxy = { '/api': { target: `http://127.0.0.1:${process.env.API_PORT || '5216'}`, changeOrigin: true } };
const port = Number(process.env.WEB_PORT || '5215');
export default defineConfig({
  server: {
    host: '127.0.0.1', port, strictPort: true, proxy,
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local-data/**', '**/.test-data/**', '**/tests/**'] },
  },
  preview: { host: '127.0.0.1', port, strictPort: true, proxy },
});
