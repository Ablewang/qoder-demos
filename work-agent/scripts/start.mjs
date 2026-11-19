import { spawn, spawnSync } from 'node:child_process';
import { constants, openSync, closeSync, fstatSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';

const repoRoot = path.resolve(import.meta.dirname, '..');

function discovery(dataDir) {
  let fd;
  try {
    fd = openSync(path.join(dataDir, 'run', 'daemon.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 4096) throw new Error();
    const info = JSON.parse(readFileSync(fd, 'utf8'));
    if (!Number.isInteger(info.pid) || info.pid <= 0 || !Number.isInteger(info.port) || info.port < 1 || info.port > 65535 || !Number.isFinite(info.startedAt) || info.protocol !== 1 || typeof info.version !== 'string') throw new Error();
    return info;
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw new Error('后台发现信息无法读取，请检查数据目录；脚本不会删除锁或发现文件。');
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

async function daemonReady(dataDir, origin, pid) {
  const info = discovery(dataDir);
  if (!info || (pid !== undefined && info.pid !== pid)) return false;
  let response;
  try {
    response = await fetch(`http://127.0.0.1:${info.port}/api/v1/health`, { headers: { Origin: origin }, redirect: 'error', signal: AbortSignal.timeout(1000) });
  } catch { return false; }
  if (response.status === 403) throw new Error('已有后台未允许开发来源，请在原后台终端 Ctrl+C 正常停止后重新启动本脚本。');
  if (!response.ok || response.headers.get('Access-Control-Allow-Origin') !== origin) return false;
  const health = await response.json().catch(() => undefined);
  return health?.ok === true && health.protocol === 1 && health.startedAt === info.startedAt && health.version === info.version;
}

async function ensureFreePort(port, host) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new Error(`开发端口 ${port} 无法使用，请先在旧前端和桌宠终端 Ctrl+C 正常停止，再运行本脚本；不会停止已有进程。`)));
    server.listen(port, host, () => server.close(resolve));
  });
}

async function waitReady(check, label, signal) {
  const deadline = Date.now() + 10_000;
  while (!signal.aborted) {
    if (await check()) return;
    if (Date.now() >= deadline) throw new Error(`${label}未能在 10 秒内就绪，请查看本终端输出。`);
    await delay(150, undefined, { signal });
  }
  throw signal.reason;
}

export async function start(root = repoRoot, sourceEnv = process.env) {
  const controller = new AbortController();
  const children = [];
  let code = 0;
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  function launch(label, args, cwd, env, desktop = false) {
    if (controller.signal.aborted) throw controller.signal.reason;
    console.log(`启动${label}…`);
    const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'inherit', 'inherit'], detached: true });
    const entry = { child, finished: false, done: undefined };
    entry.done = new Promise((resolve) => {
      const finish = (exitCode) => {
        entry.finished = true;
        resolve();
        if (controller.signal.aborted) return;
        if (!desktop || exitCode !== 0) {
          code = 1;
          console.error(`${label}已退出，启动流程停止；已有后台请在原终端正常停止后重试。`);
        }
        controller.abort();
      };
      child.once('error', () => finish(1));
      child.once('exit', finish);
    });
    children.push(entry);
    return child;
  }

  try {
    if (process.platform !== 'darwin') throw new Error('当前桌宠的系统凭证支持仅在 macOS 验证，暂不支持此平台的一键启动。');
    if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('请使用 Node.js 24，原生桌宠会校验此版本。');
    const petRoot = path.join(root, 'apps', 'pet');
    const vite = path.join(petRoot, 'node_modules', 'vite', 'bin', 'vite.js');
    const tauri = path.join(petRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
    if (!existsSync(vite) || !existsSync(tauri)) throw new Error('缺少客户端依赖，请先运行 npm --prefix apps/pet install。');
    const config = JSON.parse(readFileSync(path.join(petRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'));
    const devUrl = new URL(config.build.devUrl);
    if (devUrl.protocol !== 'http:' || devUrl.hostname !== '127.0.0.1' || !devUrl.port || devUrl.username || devUrl.password) throw new Error('桌宠开发地址必须是带端口的 http://127.0.0.1 地址。');
    const origin = devUrl.origin;
    const env = {
      ...sourceEnv,
      PATH: [path.dirname(process.execPath), path.join(sourceEnv.HOME || homedir(), '.cargo', 'bin'), sourceEnv.PATH || ''].join(path.delimiter),
      WORK_AGENT_DATA_DIR: path.resolve(root, sourceEnv.WORK_AGENT_DATA_DIR?.trim() || 'data'),
      WORK_AGENT_DEV_ORIGINS: [...new Set([...(sourceEnv.WORK_AGENT_DEV_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean), origin])].join(','),
    };
    if (spawnSync('cargo', ['--version'], { env, stdio: 'ignore', timeout: 5000 }).status !== 0) throw new Error('找不到可用的 Rust cargo，请先安装或检查 Rust 工具链。');
    await ensureFreePort(Number(devUrl.port), devUrl.hostname);
    if (controller.signal.aborted) return code;
    if (await daemonReady(env.WORK_AGENT_DATA_DIR, origin)) {
      console.log('复用已运行的后台；后台代码更新后仍需在原终端正常重启。');
    } else {
      const daemon = launch('后台', ['--disable-warning=ExperimentalWarning', 'src/daemon.ts'], root, env);
      await waitReady(() => daemonReady(env.WORK_AGENT_DATA_DIR, origin, daemon.pid), '后台', controller.signal);
    }
    launch('前端开发服务', [vite], petRoot, env);
    await waitReady(async () => {
      try {
        const response = await fetch(`${origin}/@vite/client`, { redirect: 'error', signal: AbortSignal.timeout(1000) });
        return response.ok;
      } catch { return false; }
    }, '前端', controller.signal);
    launch('桌面团子', [tauri, 'dev'], petRoot, env, true);
    console.log('后台与前端已就绪，正在编译/启动桌面团子（首次较慢）。按 Ctrl+C 退出并停止本次启动的进程；复用的后台不会停止。');
    if (!controller.signal.aborted) await once(controller.signal, 'abort');
  } catch (error) {
    if (!controller.signal.aborted) {
      code = 1;
      console.error(error instanceof Error ? error.message : '启动失败，请查看本终端输出。');
    }
  } finally {
    controller.abort();
    // Each detached child owns its process group, including Cargo and the desktop app.
    const signalGroup = (entry, signal) => {
      if (!entry.child.pid) return;
      try { process.kill(-entry.child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') code = 1; }
    };
    for (const entry of children) signalGroup(entry, 'SIGTERM');
    await Promise.race([Promise.all(children.map((entry) => entry.done)), delay(5000, undefined, { ref: false })]);
    for (const entry of children) if (!entry.finished) signalGroup(entry, 'SIGKILL');
    await Promise.all(children.map((entry) => entry.done));
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
  return code;
}

if (import.meta.main) process.exitCode = await start();
