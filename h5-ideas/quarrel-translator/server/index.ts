import { existsSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { loadEnvFile } from 'node:process';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { allowedRequest, createApp, safePath, sendError, type AppOptions, type Middleware } from './app.js';
import { ApiError } from './model.js';

export function projectRootFromEntry(entry: string | URL, production: boolean): string {
  return resolve(dirname(fileURLToPath(entry)), production ? '../..' : '..');
}

export function productionFiles(root: string): Middleware {
  const dist = resolve(root, 'dist');
  const inside = (base: string, target: string) => {
    const diff = relative(base, target);
    return diff === '' || (!diff.startsWith('..') && !isAbsolute(diff));
  };
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  };
  return (req, res, next) => {
    const serve = async () => {
      const path = safePath(req.url ?? '');
      if (!path) throw new ApiError(403, 'FORBIDDEN');
      let target = resolve(dist, path === '/' ? 'index.html' : `.${path}`);
      if (!inside(dist, target)) throw new ApiError(403, 'FORBIDDEN');
      let info;
      try { info = await stat(target); } catch {
        if (extname(path)) { next(); return; }
        target = resolve(dist, 'index.html');
        try { info = await stat(target); } catch { next(); return; }
      }
      if (!info.isFile()) { next(); return; }
      const [realRoot, realDist, realTarget] = await Promise.all([realpath(root), realpath(dist), realpath(target)]);
      if (realDist !== resolve(realRoot, 'dist') || !inside(realDist, realTarget)
        || safePath(`/${relative(realDist, realTarget)}`) === undefined) throw new ApiError(403, 'FORBIDDEN');
      const contentType = types[extname(realTarget).toLowerCase()];
      if (!contentType) { next(); return; }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (req.method === 'HEAD') { res.end(); return; }
      res.end(await readFile(realTarget));
    };
    void serve().catch((error: unknown) => sendError(res, error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR')));
  };
}

// Check symlink targets so public aliases cannot expose server secrets.
export function guardDevFiles(root: string, publicDir: string, middleware: Middleware): Middleware {
  return (req, res, next) => {
    const guard = async () => {
      const path = safePath(req.url ?? '');
      if (!path) throw new ApiError(403, 'FORBIDDEN');
      const realRoot = await realpath(root);
      const candidates = path.startsWith('/@fs/') ? [resolve(path.slice(4))]
        : [resolve(root, `.${path}`), ...(publicDir ? [resolve(publicDir, `.${path}`)] : [])];
      for (const candidate of candidates) {
        let target: string;
        try { target = await realpath(candidate); } catch { continue; }
        const diff = relative(realRoot, target);
        if (diff.startsWith('..') || isAbsolute(diff) || safePath(`/${diff}`) === undefined) {
          throw new ApiError(403, 'FORBIDDEN');
        }
      }
      middleware(req, res, next);
    };
    void guard().catch((error: unknown) => sendError(res, error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR')));
  };
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolveListen, reject) => {
    const onError = (error: NodeJS.ErrnoException) => { server.removeListener('listening', onListening); reject(error); };
    const onListening = () => { server.removeListener('error', onError); resolveListen(); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

export interface LocalServerOptions extends AppOptions {
  production?: boolean;
  root?: string;
  initialPort?: number;
}
export interface LocalServer { server: Server; port: number; url: string; close: () => Promise<void> }

export async function startLocalServer(options: LocalServerOptions = {}): Promise<LocalServer> {
  const production = options.production ?? false;
  const root = options.root ?? projectRootFromEntry(import.meta.url, production);
  // Node's loader is server-only. Tests supply env explicitly and never load a real Key.
  if (options.env === undefined) {
    const envPath = resolve(root, '.env.local');
    if (existsSync(envPath)) loadEnvFile(envPath);
  }
  let handler = createApp({ ...options, fallback: (_req, res) => sendError(res, new ApiError(503, 'INTERNAL_ERROR')) });
  const server = createServer((req, res) => handler(req, res));
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.on('clientError', (_error, socket) => { socket.destroy(); });
  let port = options.initialPort ?? 5212;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid local port');
  for (;;) {
    try { await listen(server, port); break; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE' || port === 0 || port === 65535) throw error;
      port++;
    }
  }
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Local listener unavailable');
  port = address.port;
  let closeVite: (() => Promise<void>) | undefined;
  try {
    let fallback: Middleware;
    if (production) fallback = productionFiles(root);
    else {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        root, configFile: resolve(root, 'vite.config.ts'), configLoader: 'native',
        cacheDir: resolve(root, 'server/.vite-cache'),
        optimizeDeps: { noDiscovery: true, include: [] },
        envDir: false, envPrefix: [], logLevel: 'silent',
        server: {
          middlewareMode: { server }, host: '127.0.0.1', port,
          cors: false, allowedHosts: ['127.0.0.1', 'localhost', '[::1]'],
          ws: { server }, hmr: { overlay: false }, forwardConsole: false,
          fs: { strict: true, allow: [root], deny: [
            '**/.env*', '**/server/**', '**/tests/**', '**/dist-server/**', '**/PLAN*', '**/PRD*',
          ] },
        },
      });
      closeVite = () => vite.close();
      // Apply the same Host/Origin policy before Vite's WebSocket listener.
      server.prependListener('upgrade', (req, socket) => {
        if (!allowedRequest(req) || safePath(req.url ?? '') === undefined) socket.destroy();
      });
      fallback = guardDevFiles(root, vite.config.publicDir, (req, res, next) => vite.middlewares(req, res, next));
    }
    handler = createApp({ ...options, fallback });
  } catch {
    await closeVite?.();
    await new Promise<void>((done) => server.close(() => done()));
    throw new Error('Local server could not initialize');
  }
  return {
    server, port, url: `http://127.0.0.1:${port}`,
    close: async () => {
      const closed = new Promise<void>((done, reject) => {
        server.close((error) => error ? reject(error) : done());
        server.closeAllConnections();
      });
      await closeVite?.();
      await closed;
    },
  };
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  void startLocalServer({ production: process.argv.includes('--production') }).then((local) => {
    // Only local address metadata is printed; no config or request/model contents.
    console.info(`Local app: ${local.url}`);
    let closing = false;
    const stop = () => {
      if (closing) return;
      closing = true;
      void local.close().then(() => { process.exitCode = 0; }, () => { process.exitCode = 1; });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }).catch(() => {
    console.error('Local server failed to start.');
    process.exitCode = 1;
  });
}
