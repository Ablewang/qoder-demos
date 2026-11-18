import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5213',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    permissions: ['clipboard-read', 'clipboard-write'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev --strictPort',
    url: 'http://127.0.0.1:5213',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
