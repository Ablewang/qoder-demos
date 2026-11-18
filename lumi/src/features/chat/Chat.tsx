import { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowDown, Check, ChevronRight, Copy, RotateCcw, Share } from 'lucide-react'
import type { AgentCard, Conversation, Message } from '../../api/types'
import type { CardViewState } from '../cards/CardRenderer'
import { Chip, Skeleton, Spinner, useToast } from '../../ui'
import styles from './chat.module.css'

const CardRenderer = lazy(() => import('../cards/CardRenderer').then(module => ({ default: module.CardRenderer })))

export type ChatViewState = {
  scrollTop?: number
  follow?: boolean
  cards?: Record<string, CardViewState>
  process?: Record<string, boolean>
}

function isGenerating(message: Message) {
  return message.role === 'assistant' && (message.state === 'pending' || message.state === 'streaming' || Boolean(message.statusText))
}

function isLive(message: Message) {
  return message.state === 'pending' || message.state === 'streaming'
}

function nearBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 90
}

function seconds(ms?: number) {
  return ms === undefined ? undefined : Math.max(1, Math.round(ms / 1000))
}

function processLabel(message: Message) {
  const steps = message.steps ?? []
  if (isLive(message)) return steps.find(step => step.status === 'running')?.title ?? '思考中'
  const done = steps.filter(step => step.status === 'done').length
  const time = seconds(message.thinkingMs)
  const fallback = time ? `已思考 ${time} 秒` : '思考已中断'
  if (message.state === 'aborted') return steps.length ? `已停止 · 完成 ${done}/${steps.length} 步` : fallback
  if (message.state === 'error') {
    const failed = steps.findIndex(step => step.status !== 'done')
    return failed >= 0 ? `第 ${failed + 1} 步未完成` : fallback
  }
  if (time === undefined) return '思考已中断'
  return steps.length ? `已完成 ${steps.length} 步 · 用时 ${time} 秒` : `已思考 ${time} 秒`
}

function cardSummary(card: AgentCard): string {
  switch (card.type) {
    case 'weather': return `${card.city} ${card.condition} ${card.temperature}°（${card.low}–${card.high}°）；穿搭：${card.outfit.join('、')}`
    case 'restaurants': case 'hotels': case 'places': return `${card.title}：${card.items.map(item => item.name).join('、')}`
    case 'recipe': return `${card.name}：${card.ingredients.map(item => `${item.name}${item.amount}`).join('、')}`
    case 'route': {
      const option = card.options.find(item => item.mode === card.recommended) ?? card.options[0]
      return `${card.origin} → ${card.destination}：${option ? `${option.label}约 ${option.minutes} 分钟` : ''}`
    }
    case 'reminder': return `提醒：${card.title}（${new Date(card.dueAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}）`
    case 'home': return `${card.title}：${card.tasks.map(task => task.title).join('、')}`
    case 'itinerary': return `${card.title}：${card.stops.map(stop => `${stop.time} ${stop.title}`).join('；')}`
    case 'checklist': return `${card.title}：${card.groups.flatMap(group => group.items).join('、')}`
    case 'forecast': return `${card.city}未来天气：${card.days.map(day => `${day.label}${day.condition} ${day.low}–${day.high}°`).join('；')}`
  }
}

function replyText(message: Message) {
  return [message.content.trim(), ...message.cards.map(cardSummary)].filter(Boolean).join('\n')
}

function CardPlaceholder({ onResolved }: { onResolved: () => void }) {
  useLayoutEffect(() => () => onResolved(), [onResolved])
  return <div data-chat-card-loading><Skeleton style={{ height: 210, borderRadius: 16 }} /></div>
}

function ProcessBlock({ message, open, onToggle }: { message: Message; open: boolean; onToggle: () => void }) {
  const id = useId()
  const live = isLive(message)
  const steps = message.steps ?? []
  const settled = !live
  return <div className={styles.process}>
    <button type="button" className={styles.processToggle} aria-expanded={open} aria-controls={id} onClick={onToggle}>
      {live && <Spinner size={14} />}
      <span>{processLabel(message)}</span>
      <ChevronRight className={styles.chevron} size={15} aria-hidden="true" />
    </button>
    <div id={id} className={styles.processBody} hidden={!open}>
      {message.thinking && <p className={styles.thinking}>{message.thinking}</p>}
      {steps.length > 0 && <ol className={styles.steps}>{steps.map(step => {
        const incomplete = settled && step.status !== 'done'
        return <li key={step.id} data-status={incomplete ? 'incomplete' : step.status}>
          <span className={styles.stepIcon} aria-hidden="true">{step.status === 'done' ? <Check size={13} strokeWidth={2.25} /> : step.status === 'running' && live ? <Spinner size={13} /> : <i />}</span>
          <span>{step.title}</span>
          {incomplete && <span className={styles.stepNote} aria-hidden="true">未完成</span>}
          <span className={styles.srOnly}>{step.status === 'done' ? '，已完成' : incomplete ? '，未完成' : step.status === 'running' ? '，进行中' : '，未开始'}</span>
        </li>
      })}</ol>}
    </div>
  </div>
}

export function Chat({ conversation, busy, viewState, onSend, onRetry }: {
  conversation: Conversation; busy: boolean; viewState: ChatViewState
  onSend: (query: string) => void; onRetry: (message: Message) => void
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const follow = useRef(viewState.follow ?? true)
  const intent = useRef<'restore' | 'latest' | null>(viewState.scrollTop !== undefined && !follow.current ? 'restore' : 'latest')
  const restoreTop = useRef(viewState.scrollTop ?? 0)
  const programmaticTop = useRef<number | null>(null)
  const mounted = useRef(false)
  const layoutFrame = useRef<number>()
  const previousMessages = useRef(conversation.messages)
  const currentGenerating = conversation.messages.some(isGenerating)
  const generating = useRef(currentGenerating)
  const cardStates = viewState.cards ?? (viewState.cards = {})
  const processOpen = viewState.process ?? (viewState.process = {})
  const [, setProcessVersion] = useState(0)
  const [showLatest, setShowLatest] = useState(false)
  const [copied, setCopied] = useState('')
  const { toast } = useToast()
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const lastAssistant = conversation.messages.filter(message => message.role === 'assistant').at(-1)
  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const savePosition = useCallback(() => {
    if (!scroll.current) return
    // A lazy placeholder may be shorter than the saved offset; do not save its clamp.
    viewState.scrollTop = intent.current === 'restore' ? restoreTop.current : scroll.current.scrollTop
    viewState.follow = follow.current
  }, [viewState])

  const position = useCallback(() => {
    const element = scroll.current
    if (!mounted.current || !element || !content.current) return
    const loadingCards = Boolean(content.current.querySelector('[data-chat-card-loading]'))
    const setTop = (top: number) => {
      const before = element.scrollTop
      element.scrollTop = top
      if (element.scrollTop !== before) programmaticTop.current = element.scrollTop
    }
    if (intent.current === 'restore') {
      setTop(restoreTop.current)
      if (!loadingCards) intent.current = null
    } else if (follow.current && (intent.current === 'latest' || generating.current)) {
      setTop(element.scrollHeight)
      // Keep the final generation's layout intent until its lazy cards have mounted.
      if (!generating.current && !loadingCards) intent.current = null
    } else if (!nearBottom(element)) {
      follow.current = false
    }
    savePosition()
    setShowLatest(!nearBottom(element))
  }, [savePosition])

  const onCardsResolved = useCallback(() => {
    if (!mounted.current) return
    if (layoutFrame.current !== undefined) cancelAnimationFrame(layoutFrame.current)
    layoutFrame.current = requestAnimationFrame(() => {
      layoutFrame.current = undefined
      position()
    })
  }, [position])

  useLayoutEffect(() => {
    const element = scroll.current
    const body = content.current
    if (!element || !body) return
    mounted.current = true
    let active = true
    const observer = new ResizeObserver(() => { if (active) position() })
    observer.observe(body)
    observer.observe(element)
    position()
    return () => {
      viewState.scrollTop = intent.current === 'restore' ? restoreTop.current : element.scrollTop
      viewState.follow = follow.current
      active = false
      mounted.current = false
      observer.disconnect()
      if (layoutFrame.current !== undefined) cancelAnimationFrame(layoutFrame.current)
      layoutFrame.current = undefined
    }
  }, [position, viewState])

  useLayoutEffect(() => {
    generating.current = currentGenerating
    const previous = previousMessages.current
    const lastUser = conversation.messages.filter(message => message.role === 'user').at(-1)
    const previousUser = previous.filter(message => message.role === 'user').at(-1)
    const newUser = lastUser && lastUser.id !== previousUser?.id
    const increment = conversation.messages.some(message => {
      const old = previous.find(item => item.id === message.id)
      return old && old !== message && (isGenerating(message) || (message.state === 'done' && !message.error && isGenerating(old)))
    })
    previousMessages.current = conversation.messages
    if (newUser) {
      follow.current = true
      intent.current = 'latest'
    } else if (increment && follow.current) {
      intent.current = 'latest'
    }
    position()
  }, [conversation.messages, currentGenerating, position])

  const pauseFollow = useCallback(() => {
    intent.current = null
    follow.current = false
    savePosition()
    if (scroll.current) setShowLatest(!nearBottom(scroll.current))
  }, [savePosition])

  function handleScroll() {
    const element = scroll.current
    if (!element) return
    if (programmaticTop.current !== null && Math.abs(element.scrollTop - programmaticTop.current) < 1) {
      programmaticTop.current = null
      savePosition()
      return
    }
    programmaticTop.current = null
    intent.current = null
    follow.current = nearBottom(element)
    savePosition()
    setShowLatest(!follow.current)
  }
  async function copy(message: Message) {
    try {
      await navigator.clipboard.writeText(replyText(message))
      setCopied(message.id)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(''), 1500)
    } catch { toast('浏览器未允许复制，请手动选择文字') }
  }
  async function share(message: Message) {
    try { await navigator.share({ title: conversation.title, text: replyText(message) }) } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast('当前浏览器未能打开分享')
    }
  }
  return <div className={styles.chatFrame}>
    <div className={styles.chatScroll} ref={scroll} onScroll={handleScroll}
      onWheel={pauseFollow} onTouchMove={pauseFollow}
      onPointerDown={event => { if (event.target === event.currentTarget) pauseFollow() }}
      onKeyDown={event => {
        if (event.target === event.currentTarget && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) pauseFollow()
      }}>
      <div className={styles.messages} ref={content} role="log" aria-live="off" aria-label="与 Lumi 的对话">
        <div className={styles.conversationNote}>{new Date(conversation.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</div>
        {conversation.messages.map(message => {
          if (message.role === 'user') return <div className={styles.userRow} key={message.id}><div className={styles.userBubble}>{message.content}</div></div>
          const live = isLive(message)
          const hasProcess = Boolean(message.thinking || message.steps?.length)
          const last = message === lastAssistant
          const failed = message.state === 'error' || (message.state === 'done' && Boolean(message.error))
          const showStatus = message.state === 'done' ? Boolean(message.statusText) : live && !hasProcess
          return <article className={styles.agentRow} key={message.id} data-last={last || undefined}>
            <span className={styles.srOnly}>Lumi 回复</span>
            {showStatus && <div className={styles.status}><Spinner size={14} /><span>{message.statusText || '正在加载…'}</span></div>}
            {hasProcess && <ProcessBlock message={message} open={Boolean(processOpen[message.id])} onToggle={() => { processOpen[message.id] = !processOpen[message.id]; pauseFollow(); setProcessVersion(version => version + 1) }} />}
            {message.content && <div className={styles.response}>{message.content}{message.state === 'streaming' && <span className={styles.cursor} aria-hidden="true" />}</div>}
            {message.cards.length > 0 && <div className={styles.cards}>{message.cards.map((card, cardIndex) => {
              const key = `${message.id}:${cardIndex}:${JSON.stringify(card)}`
              const cardState = cardStates[key] ?? (cardStates[key] = {})
              return <Suspense key={key} fallback={<CardPlaceholder onResolved={onCardsResolved} />}><CardRenderer card={card} viewState={cardState} onInteract={pauseFollow} busy={busy} onSend={onSend} onNotify={toast} /></Suspense>
            })}</div>}
            {message.state === 'error' && <div className={`${styles.endNote} ${styles.endError}`} role="alert"><AlertCircle size={15} aria-hidden="true" /><span><strong>这次没能完成请求</strong>{message.error ? `：${message.error}` : ''}</span></div>}
            {message.state === 'aborted' && <div className={styles.endNote}>已停止生成</div>}
            {message.state === 'done' && message.error && !message.statusText && <div className={styles.endNote} role="status">{message.error}</div>}
            {last && message.state === 'done' && !message.statusText && message.suggestions.length > 0 && <div className={styles.suggestions}>{message.suggestions.map(suggestion => <Chip key={suggestion} disabled={busy} onClick={() => onSend(suggestion)}>{suggestion}</Chip>)}</div>}
            {!isGenerating(message) && <div className={styles.actions}>
              {(message.content || message.cards.length > 0) && <button type="button" aria-label="复制回复" title={copied === message.id ? '已复制' : '复制'} onClick={() => void copy(message)}>{copied === message.id ? <Check size={18} /> : <Copy size={18} />}</button>}
              {(last || message.state !== 'done') && <button type="button" aria-label={failed ? '再试一次' : '重新生成'} title={failed ? '再试一次' : '重新生成'} disabled={busy} onClick={() => onRetry(message)}><RotateCcw size={18} /></button>}
              {canShare && message.state === 'done' && <button type="button" aria-label="分享" title="分享" onClick={() => void share(message)}><Share size={18} /></button>}
            </div>}
          </article>
        })}
        <div className={styles.endSpace} />
      </div>
    </div>
    {showLatest && <button className={styles.latest} aria-label="回到最新" title="回到最新" onClick={() => { follow.current = true; intent.current = 'latest'; position() }}><ArrowDown size={18} /></button>}
    <span className={styles.srOnly} role="status" aria-live="polite">{busy && currentGenerating ? 'Lumi 正在回复，你可以停止生成。' : '回复已结束。'}</span>
  </div>
}
