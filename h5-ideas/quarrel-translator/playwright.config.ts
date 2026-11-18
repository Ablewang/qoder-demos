import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/browser.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: './test-artifacts/browser',
  use: {
    baseURL: 'http://127.0.0.1:5212',
    browserName: 'chromium',
    launchOptions: { executablePath: process.env.BROWSER_EXECUTABLE || undefined },
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ['clipboard-read', 'clipboard-write'],
    screenshot: 'only-on-failure',
  },
});
