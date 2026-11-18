import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatEvent, ChatRequest } from '../api/types'
import { parseSSE } from '../api/sse'
import { mockFetch } from './server'

const request: ChatRequest = { conversationId: 'test', city: '杭州', query: '番茄炒蛋怎么做' }
const init = (signal?: AbortSignal): RequestInit => ({ method: 'POST', body: JSON.stringify(request), signal })
async function collect(response: Response): Promise<ChatEvent[]> {
  if (!response.body) throw new Error('missing stream')
  const result: ChatEvent[] = []
  for await (const event of parseSSE(response.body)) result.push(event)
  return result
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-17T10:00:00Z'))
  vi.stubEnv('VITE_MOCK_FAILURE_RATE', '0')
  vi.stubGlobal('location', new URL('http://localhost/'))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('mockFetch', () => {
  it('returns genuine Response and SSE with status → 2–5 character deltas → card → suggestions → done', async () => {
    const start = Date.now()
    const response = await mockFetch('/api/chat', init())
    expect(response).toBeInstanceOf(Response)
    expect(response.body).toBeInstanceOf(ReadableStream)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    const events: ChatEvent[] = []
    const deltaTimes: number[] = []
    const pending = (async () => {
      for await (const event of parseSSE(response.body!)) {
        events.push(event)
        if (event.type === 'delta') deltaTimes.push(Date.now() - start)
      }
    })()
    await vi.runAllTimersAsync()
    await pending
    expect(events[0].type).toBe('status')
    expect(events[1].type).toBe('thinking')
    const firstDelta = events.findIndex(event => event.type === 'delta')
    expect(events.slice(1, firstDelta).every(event => event.type === 'thinking')).toBe(true)
    expect(events.slice(firstDelta).some(event => event.type === 'thinking')).toBe(false)
    expect(deltaTimes[0]).toBeGreaterThanOrEqual(500)
    expect(deltaTimes[0]).toBeLessThanOrEqual(1000)
    for (let index = 1; index < deltaTimes.length; index += 1) {
      expect(deltaTimes[index] - deltaTimes[index - 1]).toBeGreaterThanOrEqual(20)
      expect(deltaTimes[index] - deltaTimes[index - 1]).toBeLessThanOrEqual(45)
    }
    for (const event of events) if (event.type === 'delta') expect(Array.from(event.text).length).toBeGreaterThanOrEqual(2)
    expect(events.filter(event => event.type === 'delta').every(event => Array.from(event.text).length <= 5)).toBe(true)
    expect(events.slice(-3).map(event => event.type)).toEqual(['card', 'suggestions', 'done'])
    expect(events.at(-1)).toEqual({ type: 'done', intent: 'recipe' })
    expect(Date.now() - start).toBeGreaterThanOrEqual(3000)
    expect(Date.now() - start).toBeLessThanOrEqual(6000)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('emits plan and steps inside the first-token window and finishes every step before cards', async () => {
    const response = await mockFetch('/api/chat', { method: 'POST', body: JSON.stringify({ ...request, query: '去西湖怎么走' }) })
    const events: ChatEvent[] = []
    const start = Date.now()
    let firstDelta = 0
    const pending = (async () => {
      for await (const event of parseSSE(response.body!)) {
        if (event.type === 'delta' && !firstDelta) firstDelta = Date.now() - start
        events.push(event)
      }
    })()
    await vi.runAllTimersAsync()
    await pending
    expect(events.slice(0, 3).map(event => event.type)).toEqual(['status', 'plan', 'step'])
    const plan = events[1]
    if (plan.type !== 'plan') throw new Error('expected plan')
    expect(plan.steps.map(step => step.id)).toEqual(['s1', 's2', 's3'])
    expect(firstDelta).toBeGreaterThanOrEqual(500)
    expect(firstDelta).toBeLessThanOrEqual(1000)
    const stepEvents = events.filter(event => event.type === 'step')
    expect(stepEvents.map(event => event.type === 'step' && `${event.id}:${event.status}`)).toEqual([
      's1:running', 's1:done', 's2:running', 's2:done', 's3:running', 's3:done',
    ])
    const lastStep = events.map(event => event.type).lastIndexOf('step')
    expect(lastStep).toBeLessThan(events.findIndex(event => event.type === 'card'))
    expect(events.at(-1)).toEqual({ type: 'done', intent: 'route_plan' })
  })

  it('keeps two status lines for replies without a process', async () => {
    const response = await mockFetch('/api/chat', { method: 'POST', body: JSON.stringify({ ...request, query: '你好' }) })
    const result = collect(response)
    await vi.runAllTimersAsync()
    const events = await result
    expect(events.slice(0, 2).map(event => event.type)).toEqual(['status', 'status'])
    expect(events.some(event => event.type === 'thinking' || event.type === 'plan')).toBe(false)
  })

  it('returns actual home JSON and accepts Request objects', async () => {
    const pending = mockFetch(new Request('http://localhost/api/home/overview'))
    await vi.runAllTimersAsync()
    const response = await pending
    expect(response.ok).toBe(true)
    expect(await response.json()).toMatchObject({ city: '杭州', date: '2026-11-17' })
  })

  it('forces 5xx with mock_fail=1', async () => {
    const pending = mockFetch('/api/chat', init(), { search: '?mock_fail=1' })
    await vi.runAllTimersAsync()
    const response = await pending
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ message: expect.stringContaining('重试') })
  })

  it('does not spend a one-shot chat failure on home and allows retry', async () => {
    const home = mockFetch('/api/home/overview', undefined, { search: '?mock_error=once' })
    await vi.runAllTimersAsync()
    expect((await home).ok).toBe(true)
    const failure = mockFetch('/api/chat', init(), { search: '?mock_error=once' })
    await vi.runAllTimersAsync()
    expect((await failure).status).toBe(503)
    const response = await mockFetch('/api/chat', init(), { search: '?mock_error=once' })
    const result = collect(response)
    await vi.runAllTimersAsync()
    expect((await result).at(-1)).toEqual({ type: 'done', intent: 'recipe' })
  })

  it('never injects a random error at default zero, but honors configured failure rate', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const successful = await mockFetch('/api/chat', init())
    expect(successful.ok).toBe(true)
    await successful.body?.cancel()
    vi.stubEnv('VITE_MOCK_FAILURE_RATE', '1')
    const pending = mockFetch('/api/chat', init())
    await vi.runAllTimersAsync()
    expect((await pending).status).toBe(503)
  })

  it('increases first-token latency with mock_latency=slow', async () => {
    const response = await mockFetch('/api/chat', init(), { search: '?mock_latency=slow' })
    const iterator = parseSSE(response.body!)
    const start = Date.now()
    expect((await iterator.next()).value).toMatchObject({ type: 'status' })
    const first = iterator.next()
    await vi.advanceTimersByTimeAsync(3000)
    let settled = false
    void first.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(2500)
    expect((await first).value).toMatchObject({ type: 'thinking' })
    const firstDelta = (async () => {
      for await (const event of iterator) {
        if (event.type === 'delta') return Date.now() - start
      }
      throw new Error('missing delta')
    })()
    await vi.runAllTimersAsync()
    expect(await firstDelta).toBeGreaterThanOrEqual(5500)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts home delay and chat first-token delay without leaving timers', async () => {
    const controller = new AbortController()
    const home = mockFetch('/api/home/overview', { signal: controller.signal })
    const rejected = expect(home).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    const chatController = new AbortController()
    const response = await mockFetch('/api/chat', init(chatController.signal))
    const pending = collect(response)
    const chatRejected = expect(pending).rejects.toThrow('响应流读取失败')
    chatController.abort()
    await chatRejected
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([0, 0.5, 0.999])('aborts during delta streaming with random=%s', async random => {
    vi.spyOn(Math, 'random').mockReturnValue(random)
    const controller = new AbortController()
    const response = await mockFetch('/api/chat', init(controller.signal))
    const events: ChatEvent[] = []
    const pending = (async () => {
      for await (const event of parseSSE(response.body!, controller.signal)) {
        events.push(event)
        if (event.type === 'delta') controller.abort()
      }
    })()
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.runAllTimersAsync()
    await rejected
    expect(events.some(event => event.type === 'delta')).toBe(true)
    expect(events.some(event => event.type === 'card' || event.type === 'done')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('validates endpoint, method and payload', async () => {
    expect((await mockFetch('/missing')).status).toBe(404)
    expect((await mockFetch('/api/chat')).status).toBe(404)
    expect((await mockFetch('/api/chat', { method: 'POST', body: '{' })).status).toBe(400)
    expect((await mockFetch('/api/chat', { method: 'POST', body: JSON.stringify({ query: '你好' }) })).status).toBe(400)
  })
})
