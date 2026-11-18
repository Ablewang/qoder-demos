import { useCallback, useEffect, useRef, useState } from 'react'
import { streamChat } from '../api/client'
import type { Message } from '../api/types'
import { applyEvent, useApp } from '../store/AppStore'

export function useChat() {
  const { state, dispatch } = useApp()
  const [busyId, setBusyId] = useState<string | null>(null)
  const active = useRef<{ controller: AbortController; conversationId: string; messageId: string; previous?: Message } | null>(null)

  const stop = useCallback(() => {
    const request = active.current
    if (!request) return
    active.current = null
    request.controller.abort()
    dispatch({ type: 'patch', id: request.conversationId, messageId: request.messageId,
      patch: request.previous ? { ...request.previous, statusText: undefined, error: '已停止重新生成，原回复已保留。' }
        : { state: 'aborted', statusText: undefined } })
    setBusyId(null)
  }, [dispatch])
  useEffect(() => () => { active.current?.controller.abort() }, [])

  async function send(conversationId: string, query: string, retryId?: string) {
    if (active.current || !query.trim()) return
    const conversation = state.conversations.find(c => c.id === conversationId)
    const original = conversation?.messages.find(m => m.id === retryId)
    const previous = original?.state === 'done' ? original : undefined
    const messageId = retryId || crypto.randomUUID()
    const now = new Date().toISOString()
    let assistant: Message = { id: messageId, role: 'assistant', content: '', createdAt: now,
      state: 'pending', cards: [], suggestions: [], query, thinking: undefined, steps: undefined, thinkingMs: undefined }
    if (retryId) {
      dispatch({ type: 'patch', id: conversationId, messageId, patch: previous
        ? { statusText: '正在重新生成，原回复已保留…', error: undefined }
        : { ...assistant, error: undefined, statusText: undefined } })
    } else {
      dispatch({ type: 'append', id: conversationId, messages: [
        { ...assistant, id: crypto.randomUUID(), role: 'user', content: query, state: 'done', query: undefined }, assistant,
      ] })
    }
    const controller = new AbortController()
    const request = { controller, conversationId, messageId, previous }
    active.current = request
    setBusyId(conversationId)
    const messages = conversation?.messages ?? []
    const retryIndex = retryId ? messages.findIndex(m => m.id === retryId) : -1
    const questionIndex = retryIndex >= 0 ? messages.slice(0, retryIndex).map(m => m.role).lastIndexOf('user') : messages.length
    const history = messages.slice(0, Math.max(0, questionIndex)).filter(m => m.state === 'done')
      .slice(-12).map(m => ({ role: m.role, content: m.content }))
    const fail = (error: string) => dispatch({ type: 'patch', id: conversationId, messageId,
      patch: previous ? { ...previous, statusText: undefined, error: `重新生成未完成，原回复已保留。${error}` }
        : { state: 'error', statusText: undefined, error } })
    try {
      for await (const event of streamChat({ conversationId, query, city: '杭州', history }, controller.signal)) {
        if (active.current !== request) return
        const at = Date.now()
        if (previous) {
          if (event.type === 'error') { fail(event.message); break }
          assistant = applyEvent(assistant, event, at)
          const step = event.type === 'step' && event.status === 'running'
            ? assistant.steps?.find(item => item.id === event.id)?.title : undefined
          const progress = event.type === 'status' ? event.text : step
          if (progress) dispatch({ type: 'patch', id: conversationId, messageId,
            patch: { statusText: `重新生成中 · ${progress}` } })
          if (event.type === 'done') dispatch({ type: 'patch', id: conversationId, messageId,
            patch: { ...assistant, error: undefined, statusText: undefined } })
        } else {
          dispatch({ type: 'event', id: conversationId, messageId, event, at })
          if (event.type === 'error') break
        }
      }
    } catch (error) {
      if (active.current === request && !controller.signal.aborted) {
        fail(error instanceof Error ? error.message : '请求未完成，请重试。')
      }
    } finally {
      if (active.current === request) {
        active.current = null
        setBusyId(null)
      }
    }
  }
  return { busyId, send, stop, isBusy: () => active.current !== null }
}
