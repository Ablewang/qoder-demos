import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react'
import type { ChatEvent, Conversation, Message, SavedItem } from '../api/types'

type Theme = 'light' | 'dark' | 'system'
type State = { conversations: Conversation[]; saved: SavedItem[]; theme: Theme; drafts: Record<string, string>; lastConversationId: string | null }
type Action =
  | { type: 'create'; conversation: Conversation }
  | { type: 'append'; id: string; messages: Message[] }
  | { type: 'event'; id: string; messageId: string; event: ChatEvent; at?: number }
  | { type: 'patch'; id: string; messageId: string; patch: Partial<Message> }
  | { type: 'save'; item: SavedItem }
  | { type: 'toggle'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'restore'; item: SavedItem; index: number }
  | { type: 'draft'; key: string; value: string }
  | { type: 'visit'; id: string }
  | { type: 'theme'; theme: Theme }
const STORAGE_KEY = 'lumi:v1'
const MAX_THINKING = 2000
export const initialState: State = { conversations: [], saved: [], theme: 'system', drafts: {}, lastConversationId: null }

function settle(message: Message): Message {
  const steps = Array.isArray(message.steps) ? message.steps : undefined
  const state = message.state === 'pending' || message.state === 'streaming' ? 'aborted' as const : message.state
  return { ...message, state, statusText: undefined, steps }
}

function load(): State {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as State | null
    if (!data || !Array.isArray(data.conversations) || !Array.isArray(data.saved)) return initialState
    const conversations = data.conversations.filter(c => c.id && Array.isArray(c.messages)).map(c => ({
      ...c,
      messages: c.messages.map(settle),
    }))
    const drafts = data.drafts && typeof data.drafts === 'object'
      ? Object.fromEntries(Object.entries(data.drafts).filter(([key, value]) => typeof value === 'string'
        && (key === 'home' || key === 'new' || conversations.some(c => c.id === key))).map(([key, value]) => [key, value.slice(0, 2000)])) : {}
    return {
      theme: ['light', 'dark', 'system'].includes(data.theme) ? data.theme : 'system',
      saved: data.saved, conversations, drafts,
      lastConversationId: conversations.some(c => c.id === data.lastConversationId) ? data.lastConversationId : null,
    }
  } catch { return initialState }
}

export function applyEvent(message: Message, event: ChatEvent, at = Date.now()): Message {
  switch (event.type) {
    case 'status': return { ...message, statusText: event.text }
    case 'thinking':
      if (message.content || message.thinkingMs !== undefined) return message
      return { ...message, thinking: ((message.thinking ?? '') + event.text).slice(0, MAX_THINKING) }
    case 'plan':
      if (message.steps?.length) return message
      return { ...message, steps: event.steps.map(step => ({ id: step.id, title: step.title, status: 'pending' as const })) }
    case 'step': {
      const steps = message.steps
      const index = steps?.findIndex(step => step.id === event.id) ?? -1
      if (!steps || index < 0 || steps[index].status === 'done' || steps[index].status === event.status) return message
      return { ...message, steps: steps.map((step, i) => i === index ? { ...step, status: event.status } : step) }
    }
    case 'delta': {
      const started = Date.parse(message.createdAt)
      const thinkingMs = message.thinkingMs ?? (Number.isFinite(started) && (message.thinking || message.steps?.length)
        ? Math.max(0, at - started) : undefined)
      return { ...message, state: 'streaming', content: message.content + event.text, statusText: undefined, thinkingMs }
    }
    case 'card': return { ...message, cards: [...message.cards, event.card] }
    case 'suggestions': return { ...message, suggestions: event.items }
    case 'done': return { ...message, state: 'done', statusText: undefined }
    case 'error': return { ...message, state: 'error', error: event.message, statusText: undefined }
  }
}

export function appReducer(state: State, action: Action): State {
  if (action.type === 'theme') return { ...state, theme: action.theme }
  if (action.type === 'visit') return state.lastConversationId === action.id ? state : { ...state, lastConversationId: action.id }
  if (action.type === 'draft') return { ...state, drafts: { ...state.drafts, [action.key]: action.value } }
  if (action.type === 'restore') {
    if (state.saved.some(item => item.id === action.item.id)) return state
    const saved = [...state.saved]
    saved.splice(action.index, 0, action.item)
    return { ...state, saved }
  }
  if (action.type === 'save') return state.saved.some(i => i.id === action.item.id)
    ? state : { ...state, saved: [action.item, ...state.saved] }
  if (action.type === 'toggle') return { ...state, saved: state.saved.map(i => i.id === action.id ? { ...i, done: !i.done } : i) }
  if (action.type === 'remove') return { ...state, saved: state.saved.filter(i => i.id !== action.id) }
  if (action.type === 'create') {
    const conversations = [action.conversation, ...state.conversations].slice(0, 30)
    const drafts = Object.fromEntries(Object.entries(state.drafts).filter(([key]) => key === 'home' || key === 'new' || conversations.some(c => c.id === key)))
    return { ...state, conversations, drafts, lastConversationId: action.conversation.id }
  }
  return {
    ...state,
    conversations: state.conversations.map(c => {
      if (c.id !== action.id) return c
      const messages = action.type === 'append' ? [...c.messages, ...action.messages] : c.messages.map(m => {
        if (m.id !== action.messageId) return m
        return action.type === 'patch' ? { ...m, ...action.patch } : applyEvent(m, action.event, action.at)
      })
      return { ...c, messages, updatedAt: new Date().toISOString() }
    }),
  }
}

const Context = createContext<{ state: State; dispatch: React.Dispatch<Action>; persistenceError: boolean } | null>(null)
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState, load)
  const [persistenceError, setPersistenceError] = useState(false)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      setPersistenceError(false)
    } catch { setPersistenceError(true) }
  }, [state])
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const update = () => { document.documentElement.dataset.theme = state.theme === 'system' ? (query.matches ? 'dark' : 'light') : state.theme }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [state.theme])
  return <Context.Provider value={{ state, dispatch, persistenceError }}>{children}</Context.Provider>
}
export function useApp() {
  const context = useContext(Context)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
export function newConversation(title: string): Conversation {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title: title.slice(0, 24), createdAt: now, updatedAt: now, messages: [] }
}
