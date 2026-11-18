import { defineConfig } from 'vite'

export default defineConfig({
  oxc: {
    jsx: { runtime: 'automatic', importSource: 'preact' },
  },
  server: {
    host: '127.0.0.1',
    port: 5214,
    strictPort: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 5215,
    strictPort: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as Parameters<typeof defineConfig>[0])
