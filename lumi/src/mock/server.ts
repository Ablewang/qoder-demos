import type { ChatEvent, ChatRequest } from '../api/types'
import { createMockReply, getMockHomeOverview } from './data'

export type MockFetchOptions = {
  /** Defaults to location.search; allows deterministic failure/latency tests. */
  search?: string
  /** Explicit client-consumed once flag. false prevents home from consuming it. */
  failOnce?: boolean
  failureRate?: number
}

let directOnceConsumed = false
const randomInteger = (minimum: number, maximum: number): number => minimum + Math.floor(Math.random() * (maximum - minimum + 1))
const abortReason = (signal: AbortSignal): Error => signal.reason instanceof Error && signal.reason.name === 'TimeoutError'
  ? signal.reason : new DOMException('请求已取消。', 'AbortError')

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortReason(signal)); return }
    const onAbort = (): void => { clearTimeout(timer); reject(abortReason(signal)) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
}

function isRequest(value: unknown): value is ChatRequest {
  if (!value || typeof value !== 'object') return false
  const request = value as Partial<ChatRequest>
  return typeof request.conversationId === 'string' && typeof request.query === 'string' && !!request.query.trim()
    && typeof request.city === 'string' && (request.history === undefined || (Array.isArray(request.history)
      && request.history.every(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')))
}

function chunks(text: string): string[] {
  const characters = Array.from(text)
  const result: string[] = []
  let index = 0
  while (index < characters.length) {
    let count = Math.min(randomInteger(2, 5), characters.length - index)
    if (characters.length - index - count === 1) count = count === 5 ? 4 : count + 1
    result.push(characters.slice(index, index + count).join(''))
    index += count
  }
  return result
}

function chatStream(request: ChatRequest, signal: AbortSignal, slow: boolean): ReadableStream<Uint8Array> {
  const work = new AbortController()
  const encoder = new TextEncoder()
  let finished = false
  let removeAbortListener = (): void => undefined
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const finish = (): void => { finished = true; removeAbortListener() }
      const onAbort = (): void => {
        if (finished) return
        finish()
        const reason = abortReason(signal)
        work.abort(reason)
        controller.error(reason)
      }
      removeAbortListener = () => signal.removeEventListener('abort', onAbort)
      signal.addEventListener('abort', onAbort, { once: true })
      if (signal.aborted) { onAbort(); return }
      const emit = (event: ChatEvent): void => {
        if (work.signal.aborted) throw abortReason(work.signal)
        // JSON envelopes are the same protocol used by the native-fetch client.
        controller.enqueue(encoder.encode(`event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`))
      }
      void (async () => {
        const reply = createMockReply(request)
        const started = Date.now()
        const extra = slow ? 5_000 : 0
        const firstTokenDelay = randomInteger(500, 1_000) + extra
        const totalDuration = randomInteger(3_400, 4_400) + extra
        const steps = reply.plan.map((title, index) => ({ id: `s${index + 1}`, title }))
        let current = 0
        const advance = (): void => {
          emit({ type: 'step', id: steps[current].id, status: 'done' })
          current += 1
          if (current < steps.length) emit({ type: 'step', id: steps[current].id, status: 'running' })
        }
        emit({ type: 'status', text: '正在理解你的需求…' })
        if (steps.length || reply.thinking) {
          // Plan and thinking share the original first-token window so total latency is unchanged.
          await delay(randomInteger(80, 160) + extra, work.signal)
          if (steps.length) {
            emit({ type: 'plan', steps })
            emit({ type: 'step', id: steps[0].id, status: 'running' })
          }
          for (const part of chunks(reply.thinking)) {
            await delay(randomInteger(15, 30), work.signal)
            emit({ type: 'thinking', text: part })
          }
          await delay(Math.max(0, firstTokenDelay - (Date.now() - started)), work.signal)
          if (steps.length > 1) advance()
        } else {
          await delay(Math.floor(firstTokenDelay / 2), work.signal)
          emit({ type: 'status', text: '正在整理适合你的建议…' })
          await delay(Math.ceil(firstTokenDelay / 2), work.signal)
        }
        const parts = chunks(reply.text)
        const midway = Math.floor(parts.length / 2)
        for (let index = 0; index < parts.length; index += 1) {
          if (index > 0) await delay(randomInteger(20, 45), work.signal)
          if (index === midway && current < steps.length - 1) advance()
          emit({ type: 'delta', text: parts[index] })
        }
        await delay(Math.max(0, totalDuration - (Date.now() - started)), work.signal)
        while (current < steps.length) advance()
        for (const card of reply.cards) emit({ type: 'card', card })
        emit({ type: 'suggestions', items: reply.suggestions })
        emit({ type: 'done', intent: reply.intent })
        finish()
        controller.close()
      })().catch(error => {
        if (!finished) { finish(); work.abort(error); controller.error(error) }
      })
    },
    cancel() {
      finished = true
      removeAbortListener()
      work.abort(new DOMException('请求已取消。', 'AbortError'))
    },
  })
}

/** Fetch-compatible local transport; third argument controls demo query injection. */
export async function mockFetch(input: RequestInfo | URL, init?: RequestInit, options: MockFetchOptions = {}): Promise<Response> {
  const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin
  const resource = input instanceof Request ? input : new URL(String(input), origin)
  const request = new Request(resource, init)
  if (request.signal.aborted) throw abortReason(request.signal)
  const path = new URL(request.url).pathname.replace(/\/$/, '')
  const home = path.endsWith('/api/home/overview') && request.method === 'GET'
  const chat = path.endsWith('/api/chat') && request.method === 'POST'
  if (!home && !chat) return json({ message: '模拟接口不存在，请检查请求地址和方法。' }, 404)
  const search = new URLSearchParams(options.search ?? (typeof location === 'undefined' ? '' : location.search))
  let failOnce = false
  if (chat) {
    if (options.failOnce !== undefined) failOnce = options.failOnce
    else {
      if (search.get('mock_error') !== 'once') directOnceConsumed = false
      if (search.get('mock_error') === 'once' && !directOnceConsumed) { directOnceConsumed = true; failOnce = true }
    }
  }
  const configuredRate = Number(options.failureRate ?? import.meta.env.VITE_MOCK_FAILURE_RATE ?? 0)
  const rate = Number.isFinite(configuredRate) ? Math.min(1, Math.max(0, configuredRate)) : 0
  if (search.get('mock_fail') === '1' || failOnce || (rate > 0 && Math.random() < rate)) {
    await delay(150, request.signal)
    return json({ message: '模拟服务暂时不可用，请点击重试。' }, 503)
  }
  if (home) {
    await delay(randomInteger(450, 900), request.signal)
    return json(getMockHomeOverview())
  }
  let body: unknown
  try { body = await request.json() } catch {
    if (request.signal.aborted) throw abortReason(request.signal)
    return json({ message: '请求格式错误，请重新输入后重试。' }, 400)
  }
  if (request.signal.aborted) throw abortReason(request.signal)
  if (!isRequest(body)) return json({ message: '请求内容不完整，请重新输入后重试。' }, 400)
  return new Response(chatStream(body, request.signal, search.get('mock_latency') === 'slow'), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
  })
}
