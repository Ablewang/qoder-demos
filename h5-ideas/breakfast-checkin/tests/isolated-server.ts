import { createApp } from '../server/app.ts';
import { Store } from '../server/store.ts';

export const TEST_ACCOUNTS = { owner: 'only-fake-owner-password', backup: 'only-fake-backup-password' };
const frontend = Number(process.env.FRONTEND_PORT);
const backend = Number(process.env.BACKEND_PORT);
if (!process.env.BROWSER_ISOLATED || !frontend || !backend || [5217, 5218].includes(frontend) || [5217, 5218].includes(backend)) throw new Error('隔离测试服务只能由 pnpm test:browser 以独立空闲端口启动');
const store = new Store(':memory:', '2026-11-17');
const { server } = createApp({ store, accounts: TEST_ACCOUNTS, origin: `http://127.0.0.1:${frontend}`, backendPort: backend });
server.listen(backend, '127.0.0.1', () => console.log(`隔离内存测试后端 http://127.0.0.1:${backend}（不使用 .local-data）`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.close(); store.close(); process.exit(0); });
