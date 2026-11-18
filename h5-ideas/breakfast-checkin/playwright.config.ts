import { defineConfig } from '@playwright/test';

const frontend = Number(process.env.FRONTEND_PORT);
const backend = Number(process.env.BACKEND_PORT);
if (!process.env.BROWSER_ISOLATED || !frontend || !backend) throw new Error('请用 pnpm test:browser 运行：它会另起内存测试后端和空闲端口，不连接 5217/5218 演示服务');
const env = { BROWSER_ISOLATED: '1', FRONTEND_PORT: String(frontend), BACKEND_PORT: String(backend) };

export default defineConfig({
  testDir: './tests',
  testMatch: 'browser.spec.ts',
  workers: 1,
  timeout: 90000,
  outputDir: './artifacts/browser-results',
  reporter: [['list']],
  webServer: [
    { command: 'pnpm exec tsx tests/isolated-server.ts', url: `http://127.0.0.1:${backend}/api/public`, reuseExistingServer: false, env, timeout: 30000 },
    { command: 'pnpm exec vite --host 127.0.0.1', url: `http://127.0.0.1:${frontend}/`, reuseExistingServer: false, env, timeout: 30000 },
  ],
  use: {
    baseURL: `http://127.0.0.1:${frontend}`,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    browserName: 'chromium',
    headless: true,
    launchOptions: { executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
    actionTimeout: 10000,
    navigationTimeout: 15000,
    screenshot: 'only-on-failure',
    trace: 'off',
  },
});
