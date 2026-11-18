import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: { timeout: 12000 },
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5175', channel: 'chrome', headless: true },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5175', reuseExistingServer: true },
})
