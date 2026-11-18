import { defineConfig } from '@playwright/test';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

async function freePort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') void freePort(0).then(resolve, reject);
      else reject(error);
    });
    server.listen(preferred, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}
const webPort = process.env.TEST_ORIGIN ? Number(new URL(process.env.TEST_ORIGIN).port) : await freePort(Number(process.env.TEST_WEB_PORT || 5225));
const apiPort = process.env.TEST_SELECTED_API_PORT ? Number(process.env.TEST_SELECTED_API_PORT) : await freePort(Number(process.env.TEST_API_PORT || 5226));
const origin = `http://127.0.0.1:${webPort}`;
process.env.TEST_ORIGIN = origin;
process.env.TEST_SELECTED_API_PORT = String(apiPort);
const env = { WEB_PORT: String(webPort), API_PORT: String(apiPort), APP_ORIGIN: origin };
console.info(`隔离浏览器验收 H5 ${origin} / API 127.0.0.1:${apiPort}，不复用活服务存档`);

export default defineConfig({
  testDir: './tests',
  testMatch: ['browser.spec.ts', 'repair.spec.ts', 'redesign.spec.ts'],
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  webServer: [
    { command: 'pnpm exec tsx tests/browser-server.ts', url: `http://127.0.0.1:${apiPort}/api/session`, env, reuseExistingServer: false },
    { command: 'pnpm dev:web', url: origin, env, reuseExistingServer: false },
  ],
  use: {
    baseURL: origin,
    viewport: { width: 390, height: 844 },
    launchOptions: {
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || join(homedir(), 'Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${join(import.meta.dirname, '.test-data/browser/tone.wav')}`, '--autoplay-policy=no-user-gesture-required'],
    },
  },
  reporter: 'list',
});
