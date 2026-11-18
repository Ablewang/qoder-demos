import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  outputDir: './test-results/browser',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5219',
    viewport: { width: 360, height: 800 },
    browserName: 'chromium',
    launchOptions: { channel: 'chrome' },
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 5219 --strictPort',
    url: 'http://127.0.0.1:5219',
    reuseExistingServer: true,
  },
});
