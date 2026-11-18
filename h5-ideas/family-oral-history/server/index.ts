import { createApp } from './app.ts';

const port = Number(process.env.API_PORT ?? 5216);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT 必须为 1–65535');
const { app, close } = createApp({ origin: process.env.APP_ORIGIN ?? 'http://127.0.0.1:5215' });
const server = app.listen(port, '127.0.0.1', () => {
  console.info(`本地家庭口述史 API：http://127.0.0.1:${port}`);
});
function shutdown() { server.close(() => { close(); }); }
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
server.once('error', (error) => { close(); console.error('本地服务启动失败', error.message); process.exitCode = 1; });
