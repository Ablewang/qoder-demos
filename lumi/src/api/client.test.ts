import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatEvent, ChatRequest } from './types'

const request: ChatRequest = { conversationId: 'test', city: '杭州', query: '番茄炒蛋怎么做', history: [] }
async function collect(events: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const result: ChatEvent[] = []
  for await (const event of events) result.push(event)
  return result
}
function sse(text: string): Response {
  return new Response(text, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })
}
function demoLocation(search: string): ReturnType<typeof vi.fn> {
  vi.stubGlobal('location', new URL(`http://localhost/chat${search}#conversation`))
  const replaceState = vi.fn((_state: unknown, _title: string, url: string) => {
    vi.stubGlobal('location', new URL(url, 'http://localhost'))
  })
  vi.stubGlobal('history', { state: { keep: true }, replaceState })
  return replaceState
}

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-17T10:00:00Z'))
  vi.stubEnv('VITE_USE_MOCK', 'true')
  vi.stubEnv('VITE_MOCK_FAILURE_RATE', '0')
  vi.stubEnv('VITE_REQUEST_TIMEOUT_MS', '20000')
  vi.stubEnv('VITE_API_BASE_URL', '')
  demoLocation('')
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('API client', () => {
  it('uses mock by default and returns HomeOverview without a mock note field', async () => {
    vi.stubEnv('VITE_USE_MOCK', undefined)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { getHomeOverview } = await import('./client')
    const pending = getHomeOverview()
    await vi.runAllTimersAsync()
    expect(await pending).toMatchObject({ city: '杭州', date: '2026-11-17', temperature: 22 })
    expect(fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    ['明天穿什么', 'weather'], ['推荐餐厅', 'restaurants'], ['番茄炒蛋怎么做', 'recipe'],
    ['推荐酒店', 'hotels'], ['去西湖', 'route'], ['附近咖啡', 'places'],
    ['提醒我明天晚上七点取快递', 'reminder'], ['整理房间', 'home'],
  ])('streams validated %s card responses', async (query, type) => {
    const { streamChat } = await import('./client')
    const pending = collect(streamChat({ ...request, query }))
    const resolved = expect(pending).resolves.toContainEqual({ type: 'card', card: expect.objectContaining({ type }) })
    await vi.runAllTimersAsync()
    await resolved
    expect((await pending).at(-1)?.type).toBe('done')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('uses native fetch with API base, request body and protocol headers when mock is false', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/v1/')
    const overview = { city: '杭州', date: '2026-11-17', temperature: 20, condition: '多云', low: 16, high: 23, airQuality: '良', outfitTip: '外套', dailyTip: '散步' }
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(overview))
      .mockResolvedValueOnce(sse('data: {"type":"delta","text":"你好"}\n\ndata: {"type":"done","intent":"chitchat"}\n\n'))
    vi.stubGlobal('fetch', fetch)
    const { getHomeOverview, streamChat } = await import('./client')
    expect(await getHomeOverview()).toEqual(overview)
    expect(await collect(streamChat(request))).toEqual([{ type: 'delta', text: '你好' }, { type: 'done', intent: 'chitchat' }])
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/v1/api/home/overview')
    expect(fetch.mock.calls[1][0]).toBe('https://api.example.test/v1/api/chat')
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify(request), headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' } })
    expect(fetch.mock.calls[1][1].signal).toBeInstanceOf(AbortSignal)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('checks HTTP status and supports forced demo failure', async () => {
    demoLocation('?mock_fail=1')
    const { getHomeOverview, streamChat } = await import('./client')
    const homeRejected = expect(getHomeOverview()).rejects.toThrow('服务暂时不可用（503）')
    await vi.runAllTimersAsync()
    await homeRejected
    const chatRejected = expect(collect(streamChat(request))).rejects.toThrow('请点击重试')
    await vi.runAllTimersAsync()
    await chatRejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it('consumes mock_error=once only on chat, preserves URL, and allows a successful retry', async () => {
    const replace = demoLocation('?mock_error=once&keep=1')
    const { getHomeOverview, streamChat } = await import('./client')
    const home = getHomeOverview()
    await vi.runAllTimersAsync()
    expect((await home).city).toBe('杭州')
    expect(location.search).toContain('mock_error=once')
    expect(replace).not.toHaveBeenCalled()
    const rejected = expect(collect(streamChat(request))).rejects.toThrow('503')
    await vi.runAllTimersAsync()
    await rejected
    expect(location.search).toBe('?mock_error=once&keep=1')
    expect(location.hash).toBe('#conversation')
    expect(replace).not.toHaveBeenCalled()
    const retry = collect(streamChat(request))
    await vi.runAllTimersAsync()
    expect((await retry).at(-1)).toEqual({ type: 'done', intent: 'recipe' })
  })

  it('rejects missing done instead of leaving loading pending', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse('data: {"type":"delta","text":"未完成"}\n\n')))
    const { streamChat } = await import('./client')
    await expect(collect(streamChat(request))).rejects.toThrow('未收到完成事件')
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    [new Response('{}', { headers: { 'Content-Type': 'application/json' } }), '未返回 SSE'],
    [sse('data: invalid\n\n'), '响应协议错误'],
    [sse('data: {"type":"card","card":{"type":"recipe"}}\n\n'), '响应协议错误'],
    [new Response('failed', { status: 403 }), '请求失败（403）'],
  ])('rejects malformed or unsuccessful chat responses', async (response, message) => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    const { streamChat } = await import('./client')
    await expect(collect(streamChat(request))).rejects.toThrow(message)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('treats an explicit protocol error event as terminal without requiring done', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sse('data: {"type":"error","message":"请重试"}\n\n')))
    const { streamChat } = await import('./client')
    expect(await collect(streamChat(request))).toEqual([{ type: 'error', message: '请重试' }])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels before dispatch without consuming a one-shot failure', async () => {
    demoLocation('?mock_error=once')
    const { streamChat } = await import('./client')
    const controller = new AbortController()
    controller.abort()
    await expect(collect(streamChat(request, controller.signal))).rejects.toMatchObject({ name: 'AbortError' })
    expect(location.search).toContain('mock_error=once')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels the first-token delay and all timers', async () => {
    const { streamChat } = await import('./client')
    const controller = new AbortController()
    const iterator = streamChat(request, controller.signal)
    expect((await iterator.next()).value).toMatchObject({ type: 'status' })
    const rejected = expect(iterator.next()).rejects.toMatchObject({ name: 'AbortError', message: '请求已取消。' })
    controller.abort()
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it('applies timeout through delta streaming, cancels the actual reader, and reports Chinese timeout', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_REQUEST_TIMEOUT_MS', '120')
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"delta","text":"开始"}\n\n')) }, cancel,
    })
    const fetch = vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
    vi.stubGlobal('fetch', fetch)
    const { streamChat } = await import('./client')
    const iterator = streamChat(request)
    expect((await iterator.next()).value).toEqual({ type: 'delta', text: '开始' })
    const rejected = expect(iterator.next()).rejects.toMatchObject({ name: 'TimeoutError', message: '请求超时，请稍后重试。' })
    await vi.advanceTimersByTimeAsync(120)
    await rejected
    expect(cancel).toHaveBeenCalledOnce()
    expect(body.locked).toBe(false)
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out a slow mock before first token and cleans up its delays', async () => {
    demoLocation('?mock_latency=slow')
    vi.stubEnv('VITE_REQUEST_TIMEOUT_MS', '1500')
    const { streamChat } = await import('./client')
    const rejected = expect(collect(streamChat(request))).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.runAllTimersAsync()
    await rejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it('times out the complete request even if fetch never returns headers', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubEnv('VITE_REQUEST_TIMEOUT_MS', '50')
    const fetch = vi.fn().mockImplementation(() => new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetch)
    const { getHomeOverview } = await import('./client')
    const rejected = expect(getHomeOverview()).rejects.toMatchObject({ name: 'TimeoutError' })
    await vi.advanceTimersByTimeAsync(50)
    await rejected
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([{}, { city: '杭州', date: 'bad date' }])('validates home protocol', async body => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
    const { getHomeOverview } = await import('./client')
    await expect(getHomeOverview()).rejects.toThrow('首页数据不符合约定')
  })

  it('normalizes network errors to Chinese', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const { getHomeOverview } = await import('./client')
    await expect(getHomeOverview()).rejects.toThrow('网络连接失败，请稍后重试。')
  })

  it('cancels transport when the consumer exits early', async () => {
    const { streamChat } = await import('./client')
    const iterator = streamChat(request)
    await iterator.next()
    await iterator.return(undefined)
    expect(vi.getTimerCount()).toBe(0)
  })
})
