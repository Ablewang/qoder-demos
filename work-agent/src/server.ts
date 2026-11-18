import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config, origin, redirectUri } from './config.ts';
import { feishuAuthUrl, feishuCallback } from './connectors/feishu.ts';
import { saveGitlabToken } from './connectors/gitlab.ts';
import { gmailAuthUrl, gmailCallback } from './connectors/gmail.ts';
import { connectors, isAuthorized, type Connector } from './connectors/index.ts';
import { llmConfigured } from './llm.ts';
import { beginAuth, consumeState } from './oauth.ts';
import { latestReportFile, runReport } from './pipeline.ts';
import { esc, page } from './render.ts';
import { deleteSecret } from './secrets.ts';

const MAX_BODY = 16 * 1024;

let running = false;
let lastRun: { at: number; warnings: string[]; error?: string } | null = null;

const OAUTH = {
  feishu: { authUrl: feishuAuthUrl, callback: feishuCallback },
  google: { authUrl: gmailAuthUrl, callback: gmailCallback },
} as const;

function send(res: ServerResponse, status: number, html: string) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

function redirect(res: ServerResponse, location: string) {
  res.writeHead(302, { Location: location });
  res.end();
}

const errorPage = (message: string) =>
  page('出错了', `<h1>出错了</h1><div class="card bad">${esc(message)}</div><a class="btn" href="/">返回首页</a>`);

async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('请求体过大');
    chunks.push(chunk as Buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}

// Blocks DNS-rebinding (Host) and cross-site form posts (Origin) against this local server.
function trusted(req: IncomingMessage): boolean {
  const allowedHosts = [`127.0.0.1:${config.port}`, `localhost:${config.port}`];
  if (!allowedHosts.includes(req.headers.host ?? '')) return false;
  if (req.method === 'POST') {
    const o = req.headers.origin;
    if (o && !allowedHosts.some((h) => o === `http://${h}`)) return false;
  }
  return true;
}

function setupSteps(c: Connector): string {
  switch (c.source) {
    case 'feishu':
      return `<ol>
        <li>飞书开发者后台 → 你的应用 → 凭证与基础信息：把 App ID、App Secret 填到 <code>.env</code> 的 <code>FEISHU_APP_ID</code>、<code>FEISHU_APP_SECRET</code></li>
        <li>开发配置 → 安全设置 → 重定向 URL：添加 <code>${esc(redirectUri('feishu'))}</code></li>
        <li>开发配置 → 权限管理：开通 <code>offline_access</code> 和 <code>calendar:calendar:readonly</code>（用户身份）</li>
        <li>创建版本并发布，新开通的权限发布后才生效；然后重启本服务</li>
      </ol>`;
    case 'gmail':
      return `<ol>
        <li>打开 Google Cloud Console，新建项目，在“API 和服务”里启用 Gmail API</li>
        <li>OAuth 同意屏幕 / Google Auth Platform：用户类型选“内部”（公司 Workspace 账号）</li>
        <li>凭据 → 创建 OAuth 客户端 ID → 类型选“桌面应用”</li>
        <li>把客户端 ID 和密钥填到 <code>.env</code> 的 <code>GOOGLE_CLIENT_ID</code>、<code>GOOGLE_CLIENT_SECRET</code>，然后重启本服务</li>
      </ol>`;
    case 'gitlab':
      return `<ol>
        <li>在 <code>.env</code> 里填写 <code>GITLAB_URL</code>（例如 https://gitlab.yourcompany.com），然后重启本服务</li>
        <li>GitLab → 偏好设置 → 访问令牌：新建个人访问令牌，范围只勾 <code>read_api</code>，设置过期时间</li>
      </ol>`;
  }
}

async function connectorCard(c: Connector): Promise<string> {
  const configured = c.configured();
  const authorized = configured && (await isAuthorized(c));
  const account = authorized ? await c.account() : null;
  const badge = !configured
    ? '<span class="badge bad">未配置</span>'
    : authorized
      ? `<span class="badge ok">已连接${account ? `：${esc(account)}` : ''}</span>`
      : '<span class="badge warn">未授权</span>';

  let actions = '';
  if (configured && c.source === 'gitlab') {
    actions = `<form class="row" method="post" action="/gitlab/token">
      <input type="password" name="token" placeholder="粘贴只读个人访问令牌（read_api）" size="40" required autocomplete="off">
      <button type="submit">${authorized ? '更换令牌' : '保存令牌'}</button></form>`;
  } else if (configured) {
    const provider = c.source === 'gmail' ? 'google' : 'feishu';
    actions = `<a class="btn" href="/auth/${provider}">${authorized ? '重新授权' : '去授权'}</a>`;
  }
  if (authorized) {
    actions += ` <form class="inline" method="post" action="/disconnect/${c.source}"><button class="secondary" type="submit">断开并删除凭证</button></form>`;
  }

  const steps = authorized ? '' : `<details ${configured ? '' : 'open'}><summary class="muted">配置步骤</summary>${setupSteps(c)}</details>`;
  return `<div class="card"><div class="row"><strong>${esc(c.label)}</strong> ${badge}</div>
    <div class="row" style="margin-top:8px">${actions}</div>${steps}</div>`;
}

async function indexPage(): Promise<string> {
  const cards = (await Promise.all(connectors.map(connectorCard))).join('');
  const llm = llmConfigured()
    ? `<span class="badge ok">已配置：${esc(config.llm.model)}</span>`
    : '<span class="badge warn">未配置</span> <span class="muted">在 .env 填写 LLM_BASE_URL、LLM_API_KEY、LLM_MODEL；不配也能出报告，只是没有分类和建议</span>';
  const last = lastRun
    ? `<div class="card"><div>上次运行：${esc(new Date(lastRun.at).toLocaleString('zh-CN'))}</div>
        ${lastRun.error ? `<div class="bad">${esc(lastRun.error)}</div>` : ''}
        ${lastRun.warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join('')}</div>`
    : '';
  const hasReport = existsSync(latestReportFile());
  return page(
    'Work Agent',
    `<h1>Work Agent</h1><div class="muted">只读连接你的工作数据，全部存在本机。授权凭证保存在 macOS 钥匙串（work-agent）。</div>
    <h2>数据来源</h2>${cards}
    <h2>模型（LiteLLM）</h2><div class="card">${llm}</div>
    <h2>时间去向报告</h2>
    <div class="card row">
      <form class="row" method="post" action="/run">
        <select name="days"><option value="7">最近 7 天</option><option value="14">最近 14 天</option><option value="30">最近 30 天</option></select>
        <button type="submit" ${running ? 'disabled' : ''}>${running ? '正在生成…' : '同步并生成报告'}</button>
      </form>
      ${hasReport ? '<a class="btn secondary" href="/report">查看最新报告</a>' : ''}
    </div>${last}`,
  );
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!trusted(req)) return send(res, 403, errorPage('请求来源不受信任'));
  const url = new URL(req.url ?? '/', origin());
  const path = url.pathname;

  if (req.method === 'GET' && path === '/') return send(res, 200, await indexPage());

  if (req.method === 'GET' && path === '/report') {
    const file = latestReportFile();
    if (!existsSync(file)) return redirect(res, '/');
    return send(res, 200, readFileSync(file, 'utf8'));
  }

  const auth = path.match(/^\/auth\/(feishu|google)$/);
  if (req.method === 'GET' && auth) {
    const provider = auth[1] as keyof typeof OAUTH;
    const { state, challenge } = beginAuth(provider);
    return redirect(res, OAUTH[provider].authUrl(state, challenge));
  }

  const callback = path.match(/^\/callback\/(feishu|google)$/);
  if (req.method === 'GET' && callback) {
    const provider = callback[1] as keyof typeof OAUTH;
    const denied = url.searchParams.get('error');
    if (denied) return send(res, 400, errorPage(`授权被拒绝：${denied}`));
    const verifier = consumeState(url.searchParams.get('state') ?? '', provider);
    const code = url.searchParams.get('code');
    if (!verifier || !code) return send(res, 400, errorPage('授权请求已过期或无效，请回首页重新发起'));
    await OAUTH[provider].callback(code, verifier);
    return redirect(res, '/');
  }

  if (req.method === 'POST' && path === '/gitlab/token') {
    const token = (await readForm(req)).get('token')?.trim();
    if (!token) return send(res, 400, errorPage('令牌为空'));
    await saveGitlabToken(token);
    return redirect(res, '/');
  }

  const disconnect = path.match(/^\/disconnect\/(feishu|gmail|gitlab)$/);
  if (req.method === 'POST' && disconnect) {
    const c = connectors.find((x) => x.source === disconnect[1]);
    for (const account of c?.secretAccounts ?? []) await deleteSecret(account);
    return redirect(res, '/');
  }

  if (req.method === 'POST' && path === '/run') {
    const days = Number((await readForm(req)).get('days'));
    if (![7, 14, 30].includes(days)) return send(res, 400, errorPage('不支持的天数'));
    if (running) return redirect(res, '/');
    running = true;
    try {
      const result = await runReport(days);
      lastRun = { at: Date.now(), warnings: result.warnings };
      return redirect(res, '/report');
    } catch (err) {
      lastRun = { at: Date.now(), warnings: [], error: (err as Error).message };
      return redirect(res, '/');
    } finally {
      running = false;
    }
  }

  send(res, 404, errorPage('页面不存在'));
}

export function startServer(): Promise<void> {
  const server = createServer((req, res) => {
    handle(req, res).catch((err: Error) => {
      if (!res.headersSent) send(res, 500, errorPage(err.message));
      else res.end();
    });
  });
  return new Promise((resolve) => server.listen(config.port, '127.0.0.1', () => resolve()));
}
