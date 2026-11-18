import type { ChatEvent } from './types'

const intents = new Set(['weather_outfit', 'food_recommend', 'recipe', 'hotel_recommend', 'route_plan', 'nearby_search', 'reminder', 'home_care', 'day_plan', 'checklist', 'chitchat'])
const modes = new Set(['walking', 'transit', 'driving', 'cycling'])
const MAX_EVENT_SIZE = 1_048_576

type RecordValue = Record<string, unknown>
const object = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value)
const string = (value: unknown): value is string => typeof value === 'string'
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const strings = (value: unknown): boolean => Array.isArray(value) && value.every(string)
const fields = (value: RecordValue, keys: string[], check: (item: unknown) => boolean): boolean => keys.every(key => check(value[key]))
const array = (value: unknown, check: (item: unknown) => boolean): boolean => Array.isArray(value) && value.every(check)
const point = (value: unknown): boolean => object(value) && number(value.lng) && number(value.lat) && Math.abs(value.lng) <= 180 && Math.abs(value.lat) <= 90

function validCard(value: unknown): boolean {
  if (!object(value)) return false
  switch (value.type) {
    case 'weather':
      return fields(value, ['city', 'condition', 'wind', 'tip'], string)
        && fields(value, ['temperature', 'low', 'high', 'feelsLike', 'humidity'], number)
        && strings(value.outfit) && array(value.hourly, item => object(item) && fields(item, ['time', 'condition'], string) && number(item.temperature))
    case 'restaurants':
      return string(value.title) && array(value.items, item => object(item)
        && fields(item, ['id', 'name', 'category', 'distance', 'address', 'color'], string)
        && fields(item, ['rating', 'price', 'walkMinutes'], number) && strings(item.tags) && point(item.point))
    case 'recipe':
      return fields(value, ['name', 'difficulty', 'tip'], string) && fields(value, ['minutes', 'servings'], number)
        && array(value.ingredients, item => object(item) && fields(item, ['name', 'amount'], string)) && strings(value.steps)
    case 'hotels':
      return string(value.title) && array(value.items, item => object(item)
        && fields(item, ['id', 'name', 'area', 'address', 'description'], string)
        && fields(item, ['rating', 'price'], number) && strings(item.tags) && point(item.point))
    case 'route':
      return fields(value, ['origin', 'destination'], string) && point(value.originPoint) && point(value.destinationPoint)
        && string(value.recommended) && modes.has(value.recommended) && array(value.options, item => object(item)
          && string(item.mode) && modes.has(item.mode) && fields(item, ['label', 'distance', 'cost'], string)
          && number(item.minutes) && strings(item.steps) && Array.isArray(item.points) && item.points.length >= 2 && item.points.every(point))
    case 'places':
      return string(value.title) && array(value.items, item => object(item) && fields(item, ['id', 'name', 'category', 'distance', 'address'], string) && point(item.point))
    case 'reminder':
      return fields(value, ['id', 'title', 'dueAt', 'note'], string) && Number.isFinite(Date.parse(value.dueAt as string))
    case 'home':
      return string(value.title) && array(value.tasks, item => object(item) && fields(item, ['title', 'detail'], string))
    case 'itinerary':
      return fields(value, ['id', 'title'], string) && array(value.stops, item => object(item)
        && fields(item, ['time', 'title', 'detail', 'address'], string) && point(item.point)
        && (item.route === undefined || string(item.route)))
    case 'checklist':
      return fields(value, ['id', 'title'], string) && array(value.groups, item => object(item) && string(item.name) && strings(item.items))
    case 'forecast':
      return fields(value, ['city', 'tip'], string) && array(value.days, item => object(item)
        && fields(item, ['label', 'condition', 'advice'], string) && fields(item, ['low', 'high', 'rain'], number))
    default:
      return false
  }
}

function validPlan(value: unknown): boolean {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return false
  const ids = new Set<string>()
  for (const item of value) {
    if (!object(item) || !string(item.id) || !string(item.title) || !item.id || !item.title.trim() || ids.has(item.id)) return false
    ids.add(item.id)
  }
  return true
}

function decodeEvent(data: string, eventName: string): ChatEvent {
  let value: unknown
  try { value = JSON.parse(data) } catch { throw new Error('响应协议错误：事件不是有效的 JSON，请重试。') }
  if (!object(value) || !string(value.type)) throw new Error('响应协议错误：缺少事件类型，请重试。')
  if (eventName && eventName !== 'message' && eventName !== value.type) throw new Error('响应协议错误：事件名称与内容不一致，请重试。')
  let valid = false
  switch (value.type) {
    case 'status': case 'delta': case 'thinking': valid = string(value.text); break
    case 'plan': valid = validPlan(value.steps); break
    case 'step': valid = string(value.id) && !!value.id && (value.status === 'running' || value.status === 'done'); break
    case 'card': valid = validCard(value.card); break
    case 'suggestions': valid = strings(value.items); break
    case 'done': valid = string(value.intent) && intents.has(value.intent); break
    case 'error': valid = string(value.message); break
  }
  if (!valid) throw new Error('响应协议错误：事件内容不符合约定，请重试。')
  return value as ChatEvent
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error && signal.reason.name === 'TimeoutError'
    ? signal.reason : new DOMException('请求已取消。', 'AbortError')
}

/** Parse UTF-8 SSE whose data payloads are JSON ChatEvent envelopes. */
export async function* parseSSE(stream: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  if (signal?.aborted) {
    await stream.cancel().catch(() => undefined)
    throw abortReason(signal)
  }
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let buffer = ''
  let data: string[] = []
  let eventName = ''
  let size = 0
  let ended = false
  const onAbort = (): void => { void reader.cancel(signal ? abortReason(signal) : undefined).catch(() => undefined) }
  signal?.addEventListener('abort', onAbort, { once: true })

  function line(text: string): ChatEvent | undefined {
    if (text === '') {
      const payload = data.join('\n')
      const name = eventName
      data = []; eventName = ''; size = 0
      return payload ? decodeEvent(payload, name) : undefined
    }
    if (text.startsWith(':')) return undefined
    const separator = text.indexOf(':')
    const key = separator === -1 ? text : text.slice(0, separator)
    let value = separator === -1 ? '' : text.slice(separator + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    size += text.length
    if (size > MAX_EVENT_SIZE) throw new Error('响应协议错误：单个事件过大，请重试。')
    if (key === 'data') data.push(value)
    if (key === 'event') eventName = value
    return undefined
  }

  try {
    while (true) {
      if (signal?.aborted) throw abortReason(signal)
      const chunk = await reader.read()
      if (signal?.aborted) throw abortReason(signal)
      buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true })
      while (true) {
        const index = buffer.search(/[\r\n]/)
        if (index < 0 || (buffer[index] === '\r' && index === buffer.length - 1 && !chunk.done)) break
        const text = buffer.slice(0, index)
        const width = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1
        buffer = buffer.slice(index + width)
        const event = line(text)
        if (signal?.aborted) throw abortReason(signal)
        if (event) yield event
      }
      if (buffer.length + size > MAX_EVENT_SIZE) throw new Error('响应协议错误：单个事件过大，请重试。')
      if (chunk.done) {
        ended = true
        if (buffer) line(buffer)
        const event = line('')
        if (event) yield event
        return
      }
    }
  } catch (error) {
    if (signal?.aborted) throw abortReason(signal)
    if (error instanceof Error && error.message.startsWith('响应协议错误')) throw error
    throw new Error('响应流读取失败，请重试。')
  } finally {
    signal?.removeEventListener('abort', onAbort)
    if (!ended) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
