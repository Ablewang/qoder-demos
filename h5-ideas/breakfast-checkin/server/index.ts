import { resolve } from 'node:path';
import { Store } from './store.ts';
import { localAccounts } from './auth.ts';
import { createApp } from './app.ts';

const port = Number(process.env.BACKEND_PORT ?? 5218);
const frontendPort = Number(process.env.FRONTEND_PORT ?? 5217);
const store = new Store(resolve('.local-data/demo.sqlite'));
const { server } = createApp({ store, accounts: localAccounts(resolve('.local-data/accounts.json')), origin: `http://127.0.0.1:${frontendPort}`, backendPort: port });
server.listen(port, '127.0.0.1', () => console.log(`假数据后端 http://127.0.0.1:${port}；模拟口令通过 pnpm credentials 查看，不提供真实运营。`));
server.on('error', () => { console.error('本地端口无法使用；请运行 pnpm dev 自动选择空闲端口。'); process.exitCode = 1; store.close(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => { store.close(); process.exit(0); }));
