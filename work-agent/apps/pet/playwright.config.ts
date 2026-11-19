import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const cached = join(homedir(), 'Library', 'Caches', 'ms-playwright', 'chromium_headless_shell-1254', 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(cached) ? cached : undefined);
export default defineConfig({
  testDir: './test', testMatch: '**/*.e2e.test.ts', fullyParallel: false, workers: 1,
  outputDir: './test-results', timeout: 20000,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:1420', headless: true, launchOptions: { executablePath, args: ['--mute-audio'] }, viewport: { width: 1100, height: 800 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node test/mock-daemon.mjs', url: 'http://127.0.0.1:18787/api/v1/health', reuseExistingServer: false, timeout: 30000 },
    { command: 'npm run preview', url: 'http://127.0.0.1:1420', reuseExistingServer: false, timeout: 30000 },
  ],
});
