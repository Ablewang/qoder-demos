import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../server/app.ts';

const root = join(import.meta.dirname, '../.test-data');
mkdirSync(root, { recursive: true, mode: 0o700 });
const dataDir = mkdtempSync(join(root, 'browser-runtime-'));
const port = Number(process.env.API_PORT);
const { app, close } = createApp({ dataDir, origin: process.env.APP_ORIGIN });
const server = app.listen(port, '127.0.0.1');
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => { close(); rmSync(dataDir, { recursive: true, force: true }); });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
server.once('error', () => { close(); rmSync(dataDir, { recursive: true, force: true }); process.exitCode = 1; });
