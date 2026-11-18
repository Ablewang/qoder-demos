import { describe, expect, it, vi } from 'vitest'
import type { ChatEvent } from './types'
import { parseSSE } from './sse'

function source(text: string, widths: number[] = [1]): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream({
    start(controller) {
      let offset = 0
      let index = 0
      while (offset < bytes.length) {
        const width = widths[index % widths.length]
        controller.enqueue(bytes.slice(offset, offset + width))
        offset += width; index += 1
      }
      controller.close()
    },
  })
}
async function collect(events: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const result: ChatEvent[] = []
  for await (const event of events) result.push(event)
  return result
}

describe('parseSSE', () => {
  it.each<[number[]]>([[[1]], [[2, 7, 3, 19]], [[128]]])('handles split UTF-8, CRLF and multiline data with widths %j', async widths => {
    const text = '\uFEFF: heartbeat\r\nid: 1\r\nretry: 1000\r\nevent: delta\r\ndata: {"type":"delta",\r\ndata: "text":"你好，杭州"}\r\n\r\ndata: {"type":"done","intent":"chitchat"}\r\n\r\n'
    expect(await collect(parseSSE(source(text, widths)))).toEqual([
      { type: 'delta', text: '你好，杭州' }, { type: 'done', intent: 'chitchat' },
    ])
  })

  it('handles LF, bare CR, comments and trailing data at EOF', async () => {
    const text = ': comment\n\nevent: status\rdata: {"type":"status","text":"准备中"}\r\rdata: {"type":"done","intent":"recipe"}'
    expect(await collect(parseSSE(source(text)))).toEqual([{ type: 'status', text: '准备中' }, { type: 'done', intent: 'recipe' }])
  })

  it.each([
    'data: nope\n\n', 'data: {}\n\n', 'data: {"type":"unknown"}\n\n',
    'data: {"type":"delta","text":123}\n\n', 'data: {"type":"done","intent":"unknown"}\n\n',
    'data: {"type":"card","card":{"type":"weather","city":"杭州"}}\n\n',
    'event: card\ndata: {"type":"delta","text":"不匹配"}\n\n',
  ])('rejects invalid protocol %s with a Chinese message', async text => {
    await expect(collect(parseSSE(source(text)))).rejects.toThrow('响应协议错误')
  })

  it('accepts thinking, plan and step events and the new intents', async () => {
    const text = [
      '{"type":"plan","steps":[{"id":"s1","title":"查找"},{"id":"s2","title":"比较"}]}',
      '{"type":"step","id":"s1","status":"running"}', '{"type":"thinking","text":"按距离"}',
      '{"type":"card","card":{"type":"forecast","city":"杭州","tip":"模拟","days":[{"label":"今天","condition":"晴","low":1,"high":9,"rain":0,"advice":"外套"}]}}',
      '{"type":"card","card":{"type":"checklist","id":"c","title":"带上","groups":[{"name":"随身","items":["伞"]}]}}',
      '{"type":"card","card":{"type":"itinerary","id":"i","title":"一日","stops":[{"time":"09:30","title":"西湖","detail":"散步","address":"湖滨","point":{"lng":120.1,"lat":30.2},"route":"去西湖怎么走"}]}}',
      '{"type":"done","intent":"day_plan"}', '{"type":"done","intent":"checklist"}',
    ].map(line => `data: ${line}\n\n`).join('')
    const events = await collect(parseSSE(source(text, [64])))
    expect(events.map(event => event.type)).toEqual(['plan', 'step', 'thinking', 'card', 'card', 'card', 'done', 'done'])
  })

  it.each([
    'data: {"type":"thinking","text":1}\n\n',
    'data: {"type":"plan","steps":[]}\n\n',
    'data: {"type":"plan","steps":[{"id":"s1","title":"a"},{"id":"s1","title":"b"}]}\n\n',
    'data: {"type":"plan","steps":[{"id":"","title":"a"}]}\n\n',
    'data: {"type":"plan","steps":[{"id":"s1","title":"  "}]}\n\n',
    `data: {"type":"plan","steps":${JSON.stringify(Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, title: '步骤' })))}}\n\n`,
    'data: {"type":"step","id":"s1","status":"pending"}\n\n',
    'data: {"type":"step","id":"","status":"done"}\n\n',
    'data: {"type":"card","card":{"type":"checklist","id":"c","title":"t","groups":[{"name":"g","items":[1]}]}}\n\n',
    'data: {"type":"card","card":{"type":"itinerary","id":"i","title":"t","stops":[{"time":"9","title":"x","detail":"d","address":"a"}]}}\n\n',
    'data: {"type":"card","card":{"type":"forecast","city":"杭州","tip":"t","days":[{"label":"今天"}]}}\n\n',
  ])('rejects invalid process or card payload %s', async text => {
    await expect(collect(parseSSE(source(text)))).rejects.toThrow('响应协议错误')
  })

  it('rejects invalid UTF-8 and bounds unframed payloads', async () => {
    const invalid = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([0xff])); controller.close() } })
    await expect(collect(parseSSE(invalid))).rejects.toThrow('响应流读取失败')
    await expect(collect(parseSSE(source('x'.repeat(1_048_577), [65_536])))).rejects.toThrow('事件过大')
  })

  it('cancels before reading with an already-aborted signal', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ cancel })
    const controller = new AbortController()
    controller.abort()
    await expect(collect(parseSSE(stream, controller.signal))).rejects.toMatchObject({ name: 'AbortError', message: '请求已取消。' })
    expect(cancel).toHaveBeenCalledOnce()
    expect(stream.locked).toBe(false)
  })

  it('cancels a pending read and releases its reader', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({ cancel })
    const controller = new AbortController()
    const pending = collect(parseSSE(stream, controller.signal))
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    expect(cancel).toHaveBeenCalled()
    expect(stream.locked).toBe(false)
  })

  it('checks cancellation between events in the same chunk', async () => {
    const controller = new AbortController()
    const iterator = parseSSE(source('data: {"type":"delta","text":"你好"}\n\ndata: {"type":"done","intent":"chitchat"}\n\n', [1024]), controller.signal)
    expect((await iterator.next()).value).toEqual({ type: 'delta', text: '你好' })
    controller.abort()
    await expect(iterator.next()).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('cancels its stream when the consumer stops early', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('data: {"type":"delta","text":"你好"}\n\n')) }, cancel,
    })
    const iterator = parseSSE(stream)
    await iterator.next()
    await iterator.return(undefined)
    expect(cancel).toHaveBeenCalledOnce()
    expect(stream.locked).toBe(false)
  })
})
