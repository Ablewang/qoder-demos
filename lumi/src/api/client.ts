import type { ChatEvent, ChatRequest, HomeOverview } from './types'
import { parseSSE } from './sse'
import { mockFetch } from '../mock/server'

let consumedOnceKey: string | null = null

function reason(signal: AbortSignal): Error {
  return signal.reason instanceof Error && signal.reason.name === 'TimeoutError'
    ? signal.reason : new DOMException('请求已取消。', 'AbortError')
}

function lifecycle(parent?: AbortSignal): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController()
  const configured = Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS ?? 20_000)
  const timeout = Number.isFinite(configured) && configured > 0 ? configured : 20_000
  const onAbort = (): void => { controller.abort(new DOMException('请求已取消。', 'AbortError')) }
  if (parent?.aborted) onAbort()
  else parent?.addEventListener('abort', onAbort, { once: true })
  // One deadline covers headers, first token AND the entire response body.
  const timer = setTimeout(() => controller.abort(new DOMException('请求超时，请稍后重试。', 'TimeoutError')), timeout)
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onAbort)
      if (!controller.signal.aborted) controller.abort(new DOMException('请求已结束。', 'AbortError'))
    },
  }
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => reject(reason(signal))
    if (signal.aborted) {
      // Attach a rejection handler even when a transport races an abort.
      void promise.catch(() => undefined)
      reject(reason(signal))
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

function searchForRequest(chat: boolean): { search: string; failOnce: boolean } {
  const search = typeof location === 'undefined' ? '' : location.search
  const params = new URLSearchParams(search)
  let failOnce = false
  if (chat) {
    if (params.get('mock_error') !== 'once') consumedOnceKey = null
    else {
      const key = params.get('mock_nonce') || 'default'
      if (key !== consumedOnceKey) {
        consumedOnceKey = key
        failOnce = true
      }
    }
  }
  return { search, failOnce }
}

export function failOncePending(search: string): boolean {
  const params = new URLSearchParams(search)
  return params.get('mock_error') === 'once' && (params.get('mock_nonce') || 'default') !== consumedOnceKey
}

async function send(path: string, init: RequestInit, signal: AbortSignal): Promise<Response> {
  if (signal.aborted) throw reason(signal)
  const base = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
  const url = `${base}${path}`
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false'
  const response = await withAbort(useMock
    ? mockFetch(url, { ...init, signal }, searchForRequest(path === '/api/chat'))
    : globalThis.fetch(url, { ...init, signal }), signal)
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined)
    throw new Error(response.status >= 500
      ? `服务暂时不可用（${response.status}），请点击重试。`
      : `请求失败（${response.status}），请检查输入后重试。`)
  }
  return response
}

function friendlyError(error: unknown, signal: AbortSignal): Error {
  if (signal.aborted) return reason(signal)
  if (error instanceof Error && /^(响应|服务|请求)/.test(error.message)) return error
  return new Error('网络连接失败，请稍后重试。')
}

function validOverview(value: unknown): value is HomeOverview {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const data = value as Record<string, unknown>
  return ['city', 'date', 'condition', 'airQuality', 'outfitTip', 'dailyTip'].every(key => typeof data[key] === 'string')
    && ['temperature', 'low', 'high'].every(key => typeof data[key] === 'number' && Number.isFinite(data[key]))
    && typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date) && Number.isFinite(Date.parse(data.date))
}

export async function getHomeOverview(signal?: AbortSignal): Promise<HomeOverview> {
  const request = lifecycle(signal)
  try {
    const response = await send('/api/home/overview', { method: 'GET', headers: { Accept: 'application/json' } }, request.signal)
    let data: unknown
    try { data = await withAbort(response.json(), request.signal) } catch (error) {
      if (request.signal.aborted) throw reason(request.signal)
      throw new Error(`响应协议错误：${error instanceof SyntaxError ? '首页数据不是有效的 JSON' : '首页数据读取失败'}，请重试。`)
    }
    if (!validOverview(data)) throw new Error('响应协议错误：首页数据不符合约定，请重试。')
    return data
  } catch (error) {
    throw friendlyError(error, request.signal)
  } finally {
    request.dispose()
  }
}

export async function* streamChat(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const active = lifecycle(signal)
  try {
    const response = await send('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify(request),
    }, active.signal)
    if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'text/event-stream' || !response.body) {
      void response.body?.cancel().catch(() => undefined)
      throw new Error('响应协议错误：聊天接口未返回 SSE 流，请重试。')
    }
    for await (const event of parseSSE(response.body, active.signal)) {
      yield event
      if (event.type === 'done' || event.type === 'error') return
    }
    throw new Error('响应中断：未收到完成事件，请点击重试。')
  } catch (error) {
    throw friendlyError(error, active.signal)
  } finally {
    active.dispose()
  }
}
