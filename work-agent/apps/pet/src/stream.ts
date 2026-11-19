import type { StreamEvent, PetUtterance } from '../../../src/contracts/index.ts';
export interface SSEMessage { event: string; data: string; id?: string; retry?: number }
export class SSEParser {
  private buffer = '';
  private event = '';
  private data: string[] = [];
  private id?: string;
  constructor(private onMessage: (m: SSEMessage) => void, private onRetry: (n: number) => void = () => {}) {}
  push(chunk: string): void {
    this.buffer += chunk;
    let end: number;
    while ((end = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, end).replace(/\r$/, ''); this.buffer = this.buffer.slice(end + 1);
      if (!line) {
        if (this.data.length) this.onMessage({ event: this.event || 'message', data: this.data.join('\n'), id: this.id });
        this.event = ''; this.data = []; this.id = undefined; continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'event') this.event = value;
      if (field === 'data') this.data.push(value);
      if (field === 'id' && !value.includes('\0')) this.id = value;
      if (field === 'retry' && /^\d+$/.test(value)) this.onRetry(Math.max(250, Number(value)));
    }
  }
}
export class EventCursor {
  lastId?: string;
  retry = 3000;
  private ids = new Set<string>();
  accept(u: PetUtterance, now = Date.now()): boolean {
    if (this.ids.has(u.id) || (u.expiresAt !== undefined && u.expiresAt <= now)) return false;
    this.ids.add(u.id);
    if (this.ids.size > 2000) this.ids.delete(this.ids.values().next().value!);
    return true;
  }
  headers(token: string): Headers {
    const headers = new Headers({ Authorization: `Bearer ${token}` });
    if (this.lastId !== undefined) headers.set('Last-Event-ID', this.lastId);
    return headers;
  }
  async receive(message: SSEMessage, onEvent: (e: StreamEvent) => Promise<void>, resync: () => Promise<void>): Promise<void> {
    let data: StreamEvent['data'];
    try { data = JSON.parse(message.data) as StreamEvent['data']; } catch { return; }
    if (message.event === 'resync_required') { await resync(); this.lastId = undefined; }
    else if (message.event === 'hello') await resync();
    else await onEvent({ type: message.event, data } as StreamEvent);
    if (message.id !== undefined) this.lastId = message.id;
    if (message.event === 'hello' && 'seq' in data) this.lastId = String(data.seq);
  }
}
