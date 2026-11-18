import { describe, expect, it } from 'vitest'
import { appReducer, initialState, applyEvent } from './AppStore'
import type { Conversation, Message, SavedItem } from '../api/types'

const item: SavedItem = { id: 'saved', kind: 'reminder', title: '带伞', detail: '检查天气', done: true, createdAt: '2026-11-17T01:00:00Z', dueAt: '2026-11-18T01:00:00Z' }
const message: Message = { id: 'reply', role: 'assistant', content: '原回复', state: 'done', createdAt: item.createdAt, cards: [], suggestions: ['明天穿什么'] }
function conversation(id: string): Conversation {
  return { id, title: id, createdAt: item.createdAt, updatedAt: item.createdAt, messages: [{ ...message }] }
}

describe('navigation and recovery state', () => {
  it('keeps independent drafts without changing conversations', () => {
    let state = appReducer(initialState, { type: 'draft', key: 'home', value: '首页草稿' })
    state = appReducer(state, { type: 'draft', key: 'new', value: '新问题' })
    state = appReducer(state, { type: 'draft', key: 'home', value: '' })
    expect(state.drafts).toEqual({ home: '', new: '新问题' })
    expect(state.conversations).toEqual([])
  })
  it('records visits independently from response updates', () => {
    let state = { ...initialState, conversations: [conversation('a'), conversation('b')] }
    state = appReducer(state, { type: 'visit', id: 'b' })
    state = appReducer(state, { type: 'event', id: 'a', messageId: 'reply', event: { type: 'delta', text: '增量' } })
    expect(state.lastConversationId).toBe('b')
    expect(state.conversations[1].messages[0].content).toBe('原回复')
  })
  it('restores original item position and completion metadata', () => {
    const first = { ...item, id: 'first' }
    const last = { ...item, id: 'last' }
    let state = { ...initialState, saved: [first, item, last] }
    state = appReducer(state, { type: 'remove', id: item.id })
    state = appReducer(state, { type: 'restore', item, index: 1 })
    expect(state.saved).toEqual([first, item, last])
    expect(state.saved[1].done).toBe(true)
  })
  it('does not duplicate an item restored twice or re-saved before undo', () => {
    const state = { ...initialState, saved: [item] }
    expect(appReducer(state, { type: 'restore', item, index: 0 })).toBe(state)
  })
  it('bounds restoration to the current list when its size changed', () => {
    const state = appReducer(initialState, { type: 'restore', item, index: 10 })
    expect(state.saved).toEqual([item])
  })
  it('prunes dropped conversation drafts while retaining shared drafts', () => {
    const state = { ...initialState, conversations: Array.from({ length: 30 }, (_, i) => conversation(String(i))), drafts: { home: '首页', new: '新', '29': '旧', '0': '当前' } }
    const next = appReducer(state, { type: 'create', conversation: conversation('new-id') })
    expect(next.conversations).toHaveLength(30)
    expect(next.lastConversationId).toBe('new-id')
    expect(next.drafts).toEqual({ home: '首页', new: '新', '0': '当前' })
  })
  it('retains old successful content during retry status and atomically replaces on success', () => {
    let state = { ...initialState, conversations: [conversation('a')] }
    state = appReducer(state, { type: 'patch', id: 'a', messageId: 'reply', patch: { statusText: '重新生成中' } })
    expect(state.conversations[0].messages[0]).toMatchObject({ content: '原回复', state: 'done', suggestions: ['明天穿什么'] })
    state = appReducer(state, { type: 'patch', id: 'a', messageId: 'reply', patch: { content: '新回复', state: 'done', statusText: undefined, suggestions: [] } })
    expect(state.conversations[0].messages).toHaveLength(1)
    expect(state.conversations[0].messages[0].content).toBe('新回复')
  })
  it('buffers events without mutating the original successful message', () => {
    const buffered = applyEvent({ ...message, content: '', state: 'pending', suggestions: [] }, { type: 'delta', text: '新' })
    expect(buffered.content).toBe('新')
    expect(message.content).toBe('原回复')
  })
})

describe('process events', () => {
  const pending: Message = { ...message, content: '', state: 'pending', suggestions: [], createdAt: '2026-11-17T10:00:00.000Z' }
  const at = Date.parse(pending.createdAt)
  const plan: Parameters<typeof applyEvent>[1] = { type: 'plan', steps: [{ id: 's1', title: '查找' }, { id: 's2', title: '比较' }] }

  it('moves steps forward only and ignores unknown ids and repeated plans', () => {
    let next = applyEvent(pending, plan)
    expect(next.steps?.map(step => step.status)).toEqual(['pending', 'pending'])
    next = applyEvent(next, { type: 'step', id: 's1', status: 'running' })
    next = applyEvent(next, { type: 'step', id: 's1', status: 'done' })
    next = applyEvent(next, { type: 'step', id: 's1', status: 'running' })
    expect(applyEvent(next, { type: 'step', id: 'nope', status: 'done' })).toBe(next)
    expect(applyEvent(next, { type: 'plan', steps: [{ id: 'x', title: '另一个' }] })).toBe(next)
    expect(next.steps?.map(step => step.status)).toEqual(['done', 'pending'])
  })

  it('times thinking until the first delta, ignores later thinking and bounds its length', () => {
    let next = applyEvent(pending, { type: 'thinking', text: '想'.repeat(2500) }, at + 100)
    expect(next.thinking).toHaveLength(2000)
    next = applyEvent(next, { type: 'delta', text: '正文' }, at + 820)
    expect(next.thinkingMs).toBe(820)
    next = applyEvent(next, { type: 'delta', text: '继续' }, at + 2000)
    expect(next.thinkingMs).toBe(820)
    expect(applyEvent(next, { type: 'thinking', text: '迟到' })).toBe(next)
  })

  it('does not time replies without a process', () => {
    expect(applyEvent(pending, { type: 'delta', text: '你好' }, at + 600).thinkingMs).toBeUndefined()
  })

  it('clears an earlier process when a retry patch replaces the message body', () => {
    let state: typeof initialState = { ...initialState, conversations: [{ ...conversation('a'), messages: [{ ...applyEvent(pending, plan), state: 'error' as const, thinking: '旧', thinkingMs: 300 }] }] }
    state = appReducer(state, { type: 'patch', id: 'a', messageId: 'reply', patch: { ...pending, thinking: undefined, steps: undefined, thinkingMs: undefined } })
    expect(state.conversations[0].messages[0]).toMatchObject({ thinking: undefined, steps: undefined, thinkingMs: undefined })
  })
})
