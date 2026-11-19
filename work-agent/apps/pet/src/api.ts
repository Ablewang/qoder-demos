import type { DaemonInfo, HealthResponse, PetState, PersonaView, NoticeListResponse, CompanionSettings, StreamEvent } from '../../../src/contracts/index.ts';
import { bridge } from './bridge.ts';
import { EventCursor, SSEParser } from './stream.ts';
export interface Snapshot { state: PetState; persona: PersonaView; notices: NoticeListResponse; settings: CompanionSettings }
class ConnectionError extends Error {}
export class Api {
  readonly cursor = new EventCursor();
  private token = '';
  private info?: DaemonInfo;
  private abort?: AbortController;
  private stopped = false;
  private delayTimer?: ReturnType<typeof setTimeout>;
  private resume?: () => void;
  constructor(private snapshot: (s: Snapshot) => void | Promise<void>, private event: (e: StreamEvent) => Promise<void>, private offline: () => void) {}
  private url(path: string): string { if (!this.info) throw new Error('办公功能离线'); return `http://127.0.0.1:${this.info.port}/api/v1${path}`; }
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(this.url(path), { method, headers: { Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      if (response.status === 401) { this.token = ''; throw new ConnectionError('本机认证失败，办公功能离线'); }
      if (response.status === 403) throw new ConnectionError('后台拒绝桌宠连接，请重启后台后再唤醒');
      throw new Error(response.status === 501 || response.status === 404 ? '此接口暂不可用' : response.status === 409 ? '文件已变化，请刷新后再试' : '操作失败，请检查后台状态');
    }
    return await response.json() as T;
  }
  private async discover(): Promise<void> {
    const info = await bridge.info().catch(() => { throw new ConnectionError('后台启动信息不可用，请重新启动后台'); });
    const response = await fetch(`http://127.0.0.1:${info.port}/api/v1/health`, { signal: AbortSignal.timeout(2000) })
      .catch(() => { throw new ConnectionError('本机连接失败，请重启后台和团子'); });
    if (response.status === 403) throw new ConnectionError('后台拒绝桌宠连接，请重启后台后再唤醒');
    const health = await response.json() as HealthResponse;
    if (!response.ok || !health.ok || health.protocol !== 1 || health.startedAt !== info.startedAt) throw new ConnectionError('后台启动信息已失效，请重新启动后台');
    if (this.info && this.info.startedAt !== info.startedAt) this.cursor.lastId = undefined;
    this.info = info;
    this.token = await bridge.token().catch(() => { throw new ConnectionError('本机凭证读取失败，请检查系统授权提示'); });
  }
  async resync(): Promise<void> {
    const [state, persona, notices, settings] = await Promise.all([
      this.request<PetState>('/pet/state'), this.request<PersonaView>('/pet/persona'),
      this.request<NoticeListResponse>('/notices?limit=200'), this.request<CompanionSettings>('/pet/settings'),
    ]);
    await this.snapshot({ state, persona, notices, settings });
  }
  async start(): Promise<void> {
    this.stopped = false;
    while (!this.stopped) {
      try {
        await this.discover(); await this.resync();
        this.abort = new AbortController();
        const response = await fetch(this.url('/stream'), { headers: this.cursor.headers(this.token), signal: this.abort.signal });
        if (!response.ok || !response.body) throw new Error('offline');
        const reader = response.body.getReader(); const decoder = new TextDecoder();
        let chain = Promise.resolve();
        const parser = new SSEParser(message => { chain = chain.then(() => this.cursor.receive(message, this.event, () => this.resync())); }, n => { this.cursor.retry = n; });
        while (!this.stopped) { const result = await reader.read(); if (result.done) break; parser.push(decoder.decode(result.value, { stream: true })); await chain; }
        await chain;
        if (!this.stopped) throw new Error('offline');
      } catch { if (!this.stopped) this.offline(); }
      if (!this.stopped) await new Promise<void>(resolve => { this.resume = resolve; this.delayTimer = setTimeout(resolve, this.cursor.retry); });
    }
  }
  async wake(): Promise<void> {
    await bridge.wake().catch(() => { throw new ConnectionError('无法启动本机后台，请检查桌宠启动终端'); });
    const deadline = Date.now() + 10000;
    let failure = new ConnectionError('后台连接失败，请重启后台和团子');
    while (Date.now() < deadline) {
      try { await this.discover(); await this.resync(); clearTimeout(this.delayTimer); this.resume?.(); return; }
      catch (error) { if (error instanceof ConnectionError) failure = error; await new Promise(resolve => setTimeout(resolve, 250)); }
    }
    throw failure;
  }
  stop(): void { this.stopped = true; this.abort?.abort(); clearTimeout(this.delayTimer); this.resume?.(); }
}
