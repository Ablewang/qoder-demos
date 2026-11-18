import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import type { GuardianView, MeView, Principal } from '../src/types.ts';
import { Auth, type Accounts } from './auth.ts';
import { Store } from './store.ts';
import { ApiError, FIXTURES, SHOP_ID, accessResident, addLeave, advanceDay, cancelLeave, changeDay, claimTask, contactResult, correctTask, enroll, ensure, guardianConsent, invalidate, reconcile, recordArrival, releaseTask, removeArrival, review, staff, staffView, withdraw, type State } from './domain.ts';

function cookie(request: IncomingMessage): string {
  return (request.headers.cookie ?? '').split(';').map(item => item.trim()).find(item => item.startsWith('demo_session='))?.slice(13) ?? '';
}
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  ensure(request.headers['content-type']?.startsWith('application/json'), 415, '仅接收 JSON 演示请求');
  let value = '';
  for await (const chunk of request) { value += chunk.toString(); ensure(Buffer.byteLength(value) <= 10000, 413, '请求过大'); }
  try {
    const parsed: unknown = JSON.parse(value);
    ensure(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 400, '请求格式无效');
    return parsed as Record<string, unknown>;
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, '请求格式无效'); }
}
function fields(input: Record<string, unknown>, keys: string[]): void {
  ensure(Object.keys(input).every(key => keys.includes(key)), 400, '演示不接收姓名、电话或额外字段');
}
export function createApp(options: { store: Store; accounts: Accounts; origin: string; backendPort?: number }) {
  const { store } = options; const auth = new Auth(options.accounts);
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer'); response.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : options.backendPort;
      ensure(request.headers.host === `127.0.0.1:${port}`, 403, '只接受本机受控 Host');
      ensure(!request.url?.includes('?'), 400, 'API 不接受 URL 参数或凭证');
      const path = request.url ?? '/'; const method = request.method;
      if (method === 'GET' && path === '/api/public') return send(response, { shopId: SHOP_ID, shopName: '暖灶早点铺 · 虚构演示店', demo: true, disclaimer: '演示数据，不提供安全保障；未进行真人试点，不通知、不拨号、不安排上门。' });
      if (method === 'POST') ensure(request.headers.origin === options.origin, 403, '拒绝非本页面来源的写入');
      const input = method === 'POST' ? await body(request) : {};
      if (method === 'POST' && path === '/api/login') {
        fields(input, ['account', 'password']); const principal = auth.login(input.account, input.password);
        auth.revoke(cookie(request)); return issue(response, auth, principal);
      }
      if (method === 'POST' && path === '/api/pair') {
        fields(input, ['ticket']); const principal = auth.exchange(input.ticket);
        accessResident(store.read(), principal, principal.residentId!, true);
        if (principal.role === 'resident') ensure(store.read().residents.find(item => item.id === principal.residentId)?.status === 'active', 409, '模拟双方同意未完成');
        auth.revoke(cookie(request)); return issue(response, auth, principal);
      }
      const token = cookie(request); const session = auth.get(token); const principal = session.principal;
      if (principal.residentId) accessResident(store.read(), principal, principal.residentId, true);
      if (method === 'POST') ensure(request.headers['x-csrf-token'] === session.csrf, 403, 'CSRF 校验失败');
      if (method === 'GET' && path === '/api/session') return send(response, { principal, csrf: session.csrf });
      if (method === 'POST' && path === '/api/logout') { fields(input, []); auth.revoke(token); response.setHeader('Set-Cookie', 'demo_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0'); return send(response, { ok: true }); }
      if (method === 'GET' && path === '/api/fixtures') { staff(principal); return send(response, FIXTURES); }
      if (method === 'GET' && path === '/api/staff') { staff(principal); return send(response, staffView(store.read())); }
      if (method === 'GET' && path === '/api/me') {
        ensure(principal.role === 'resident', 403, '仅本人可读取本人页'); const state = store.read();
        const resident = accessResident(state, principal, principal.residentId!);
        const result: MeView = { today: state.today, version: state.version, resident, arrival: state.arrivals.find(item => item.residentId === resident.id && item.date === state.today), leaves: state.leaves.filter(item => item.residentId === resident.id), paused: state.paused };
        return send(response, result);
      }
      if (method === 'GET' && path === '/api/guardian') {
        ensure(principal.role === 'guardian', 403, '仅指定模拟联系人可读取'); const state = store.read();
        const resident = accessResident(state, principal, principal.residentId!, true);
        const result: GuardianView & { version: number } = { name: resident.name, guardianName: resident.guardianName, accepted: resident.guardianConsent, paused: state.paused, version: state.version };
        return send(response, result);
      }
      ensure(method === 'POST', 404, '接口不存在');
      if (path === '/api/tickets') {
        staff(principal); fields(input, ['residentId', 'role']);
        ensure(typeof input.residentId === 'string' && typeof input.role === 'string' && ['resident', 'guardian'].includes(input.role), 400, '请选择受限配对角色');
        const resident = accessResident(store.read(), principal, input.residentId);
        if (input.role === 'resident') ensure(resident.status === 'active', 409, '等待模拟双方同意');
        return send(response, { ticket: auth.ticket({ shopId: SHOP_ID, role: input.role as 'resident' | 'guardian', id: `${input.role}:${resident.id}`, residentId: resident.id }) });
      }
      if (path === '/api/reset') {
        ensure(principal.role === 'owner', 403, '仅模拟店主能清空演示数据'); fields(input, ['confirmed']); ensure(input.confirmed === true, 400, '请明确确认清空假数据');
        store.reset(); auth.clear(); response.setHeader('Set-Cookie', 'demo_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0'); return send(response, { ok: true });
      }
      const match = path.match(/^\/api\/residents\/([a-z-]+)\/(arrival|void|leave|cancel-leave|withdraw)$/);
      const taskMatch = path.match(/^\/api\/tasks\/([a-f0-9-]+)\/(claim|release|result|correct)$/);
      const routes: Record<string, { keys: string[]; run: (state: State) => unknown; idempotent?: boolean }> = {
        '/api/enroll': { keys: ['fixtureId', 'threshold', 'weekdays', 'simulatedElderConsent'], run: state => enroll(state, principal, input as never) },
        '/api/consent': { keys: ['accepted'], run: state => guardianConsent(state, principal, input.accepted) },
        '/api/review': { keys: ['date'], run: state => review(state, principal, input.date) },
        '/api/day': { keys: ['open'], run: state => changeDay(state, principal, input.open) },
        '/api/advance': { keys: [], run: state => advanceDay(state, principal) },
        '/api/pause': { keys: ['paused'], run: state => { staff(principal); ensure(typeof input.paused === 'boolean', 400, '必须明确暂停状态'); state.paused = input.paused; invalidate(state, state.days[0].date, state.today); } },
      };
      let route = routes[path];
      if (match) {
        const [, id, action] = match;
        const actions = {
          arrival: { keys: ['witnessed'], run: (state: State) => recordArrival(state, principal, id, input.witnessed), idempotent: true },
          void: { keys: [], run: (state: State) => removeArrival(state, principal, id) },
          leave: { keys: ['start', 'end'], run: (state: State) => addLeave(state, principal, id, input.start, input.end) },
          'cancel-leave': { keys: ['leaveId'], run: (state: State) => cancelLeave(state, principal, id, input.leaveId) },
          withdraw: { keys: [], run: (state: State) => withdraw(state, principal, id) },
        };
        route = actions[action as keyof typeof actions];
      }
      if (taskMatch) {
        const [, id, action] = taskMatch;
        const actions = {
          claim: { keys: [], run: (state: State) => claimTask(state, principal, id) },
          release: { keys: [], run: (state: State) => releaseTask(state, principal, id) },
          result: { keys: ['outcome', 'nextDate'], run: (state: State) => contactResult(state, principal, id, input.outcome, input.nextDate) },
          correct: { keys: [], run: (state: State) => correctTask(state, principal, id) },
        };
        route = actions[action as keyof typeof actions];
      }
      ensure(route, 404, '接口不存在'); fields(input, [...route.keys, 'requestId', 'version']);
      ensure(typeof input.requestId === 'string' && /^[a-f0-9-]{36}$/.test(input.requestId), 400, '需要有效操作标识');
      ensure(Number.isInteger(input.version), 400, '需要页面版本');
      const fingerprint = createHash('sha256').update(JSON.stringify({ path, principal, input })).digest('hex');
      const receiptKey = `${principal.id}:${input.requestId}`;
      const result = store.write(state => {
        const previous = state.receipts[receiptKey];
        if (previous) { ensure(previous.fingerprint === fingerprint, 409, '同一操作标识不能用于不同请求'); return previous.result; }
        if (!route.idempotent) ensure(input.version === state.version, 409, '名单已更新，请刷新后核对再操作');
        const value = route.run(state) ?? { ok: true };
        state.version += 1; reconcile(state);
        if (match?.[2] !== 'withdraw') state.receipts[receiptKey] = { fingerprint, result: value };
        if (Object.keys(state.receipts).length > 500) delete state.receipts[Object.keys(state.receipts)[0]];
        return value;
      });
      if (match?.[2] === 'withdraw') { auth.revokeResident(match[1]); store.compact(); }
      if (path === '/api/consent' && input.accepted === false) { auth.revokeResident(principal.residentId!); store.compact(); }
      return send(response, result);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      send(response, { error: error instanceof ApiError ? error.message : '本地服务异常，资料状态未知，请勿当作已核对' }, status);
    }
  });
  return { server, auth };
}
function send(response: ServerResponse, value: unknown, status = 200): void { response.statusCode = status; response.end(JSON.stringify(value)); }
function issue(response: ServerResponse, auth: Auth, principal: Principal): void {
  const { token, session } = auth.issue(principal);
  response.setHeader('Set-Cookie', `demo_session=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800`);
  send(response, { principal, csrf: session.csrf });
}
