import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const reserved = new Set([5217, 5218]);
async function free(start: number, taken: Set<number>): Promise<number> {
  for (let port = start; port < start + 100; port += 1) {
    if (taken.has(port)) continue;
    const ok = await new Promise<boolean>(done => {
      const server = createServer();
      server.once('error', () => done(false));
      server.listen(port, '127.0.0.1', () => server.close(() => done(true)));
    });
    if (ok) return port;
  }
  throw new Error('找不到空闲本地端口；未终止任何其他进程');
}
// Compare metadata only so the live demo archive is never opened or parsed.
function snapshot(): string {
  const directory = resolve('.local-data');
  if (!existsSync(directory)) return 'absent';
  return readdirSync(directory).sort().map(name => { const info = statSync(join(directory, name)); return `${name}:${info.size}:${info.mtimeMs}`; }).join('|');
}
const frontend = await free(Number(process.env.TEST_FRONTEND_PORT ?? 5317), reserved);
const backend = await free(frontend + 1, new Set([...reserved, frontend]));
const before = snapshot();
console.log(`隔离浏览器回归：前端 127.0.0.1:${frontend}，内存后端 127.0.0.1:${backend}`);
const child = spawn('pnpm', ['exec', 'playwright', 'test', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, BROWSER_ISOLATED: '1', FRONTEND_PORT: String(frontend), BACKEND_PORT: String(backend) } });
child.on('exit', code => {
  const unchanged = snapshot() === before;
  console.log(unchanged ? '.local-data 文件大小与修改时间未变化（未读取其内容）' : '警告：.local-data 元数据发生变化');
  process.exitCode = unchanged ? code ?? 1 : 1;
});
