import { createServer } from 'node:net';
import { spawn } from 'node:child_process';

async function available(start: number, excluded?: number): Promise<number> {
  for (let port = start; port < start + 50; port += 1) {
    if (port === excluded) continue;
    const free = await new Promise<boolean>(resolve => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error('本地端口不可用；未终止任何其他进程');
}
const frontend = await available(Number(process.env.FRONTEND_PORT ?? 5217));
const backend = await available(Number(process.env.BACKEND_PORT ?? 5218), frontend);
const env = { ...process.env, FRONTEND_PORT: String(frontend), BACKEND_PORT: String(backend) };
console.log(`仅本地假数据：前端 http://127.0.0.1:${frontend}，后端 http://127.0.0.1:${backend}`);
const children = ['dev:server', 'dev:frontend'].map(script => spawn('pnpm', ['run', script], { env, stdio: 'inherit' }));
let stopping = false;
function stop(code = 0): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => stop());
for (const child of children) child.on('exit', code => stop(code ?? 0));
