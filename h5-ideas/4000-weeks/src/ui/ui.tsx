import type { ComponentChildren } from 'preact'
import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { formatWeekRange, weekKey, weekNumberSince } from '../lib/date'
import { EMOJIS, MAX_TEXT, MILESTONE_HINTS, MOODS, MOOD_KEYS, RELATION_LABEL, isEntryEmpty, type Life } from '../lib/model'
import { go } from '../router'
import { getEntry, saveEntry, saveFailureMessage, type EntryDraft } from '../state/store'

export function NameSignature(props: { name: string }) {
  const split = props.name.search(/[（(]/)
  return split > 0 ? <><span>{props.name.slice(0, split)}</span><span class="signature-qualifier">{props.name.slice(split)}</span></> : <>{props.name}</>
}

const modalStack: HTMLDivElement[] = []
let bodyOverflow = ''
let rootOverflow = ''

function focusableIn(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [contenteditable="true"]'))
    .filter((node) => node.tabIndex >= 0 && !node.matches(':disabled') && !node.closest('[hidden], [inert]') && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden')
}

export function Modal(props: { title: string; onClose: () => void; children: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const onClose = useRef(props.onClose)
  onClose.current = props.onClose
  const titleId = useId()
  const isTop = () => !!ref.current && modalStack[modalStack.length - 1] === ref.current
  useLayoutEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current
    if (!el) return
    if (modalStack.length === 0) {
      bodyOverflow = document.body.style.overflow
      rootOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
    }
    modalStack.push(el)
    const targets = focusableIn(el)
    const first = targets.find((node) => node.matches('textarea, input[type="text"]'))
      ?? targets.find((node) => node.matches('.row-btns button'))
      ?? targets[0]
      ?? el
    first.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || modalStack[modalStack.length - 1] !== el) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose.current()
      } else if (e.key === 'Tab') {
        const targets = focusableIn(el)
        const first = targets[0]
        const last = targets[targets.length - 1]
        const active = document.activeElement
        if (!first || !last) {
          e.preventDefault()
          el.focus({ preventScroll: true })
        } else if (!active || !targets.includes(active as HTMLElement) || (e.shiftKey ? active === first : active === last)) {
          e.preventDefault()
          const target = e.shiftKey ? last : first
          target.focus({ preventScroll: true })
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const wasTop = modalStack[modalStack.length - 1] === el
      const index = modalStack.indexOf(el)
      if (index !== -1) modalStack.splice(index, 1)
      const top = modalStack[modalStack.length - 1]
      if (modalStack.length === 0) {
        document.body.style.overflow = bodyOverflow
        document.documentElement.style.overflow = rootOverflow
      }
      if (wasTop) {
        if (prev?.isConnected && (!top || top.contains(prev))) prev.focus({ preventScroll: true })
        else if (top) (focusableIn(top)[0] ?? top).focus({ preventScroll: true })
      }
    }
  }, [])
  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && isTop() && props.onClose()}>
      <div class={`modal${props.wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div class="modal-head">
          <h2 class="modal-title" id={titleId}>{props.title}</h2>
          <button type="button" class="modal-close" aria-label="关闭" onClick={() => isTop() && props.onClose()}>
            关闭
          </button>
        </div>
        {props.children}
      </div>
    </div>
  )
}

export function Confirm(props: {
  title: string
  message: ComponentChildren
  confirmText: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={props.title} onClose={props.onCancel}>
      <div class="confirm-msg">{props.message}</div>
      <div class="row-btns">
        <button type="button" class="btn" onClick={props.onCancel}>
          取消
        </button>
        <button type="button" class={`btn ${props.danger ? 'danger' : 'primary'}`} onClick={props.onConfirm}>
          {props.confirmText}
        </button>
      </div>
    </Modal>
  )
}

export function Stepper(props: { label: string; value: number; min: number; max: number; unit?: string; onChange: (n: number) => void }) {
  const set = (n: number) => props.onChange(Math.min(props.max, Math.max(props.min, n)))
  return (
    <div class="stepper">
      <span class="stepper-label">{props.label}</span>
      <div class="stepper-ctl">
        <button type="button" aria-label={`${props.label}减一`} onClick={() => set(props.value - 1)} disabled={props.value <= props.min}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label={props.label}
          min={props.min}
          max={props.max}
          value={props.value}
          onChange={(e) => {
            const n = Number((e.target as HTMLInputElement).value)
            if (Number.isFinite(n)) set(Math.round(n))
          }}
        />
        <button type="button" aria-label={`${props.label}加一`} onClick={() => set(props.value + 1)} disabled={props.value >= props.max}>
          ＋
        </button>
        {props.unit && <span class="stepper-unit">{props.unit}</span>}
      </div>
    </div>
  )
}

export function EntryFields(props: { life: Life; draft: EntryDraft; onChange: (d: EntryDraft) => void; compact?: boolean; status?: ComponentChildren; statusId?: string }) {
  const { life, draft, onChange } = props
  const set = (patch: Partial<EntryDraft>) => onChange({ ...draft, ...patch })
  const [showMore, setShowMore] = useState(false)
  const sentenceRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = sentenceRef.current!
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [draft.text])
  const controlsId = useId()
  const count = (draft.text?.length ?? 0) > 60 && <div class="hint">{draft.text!.length} / {MAX_TEXT} 字 · 一句话就够了</div>
  return (
    <div class="entry-fields">
      <textarea
        class="sentence"
        ref={sentenceRef}
        rows={3}
        maxLength={MAX_TEXT}
        placeholder="这一周，用一句话记住它…"
        value={draft.text ?? ''}
        aria-label={`${life.name}这一周的一句话`}
        aria-describedby={props.statusId}
        onInput={(e) => set({ text: (e.target as HTMLTextAreaElement).value })}
      />
      {props.status === undefined ? count : <div class="sentence-meta">{props.status}{count}</div>}
      {(draft.color || draft.emoji || draft.milestone || draft.met) && (
        <div class="entry-summary" aria-label="这一周已有的颜色与标记">
          {draft.color && (
            <span class="entry-summary-item">
              <span class="color-circle" style={{ background: MOODS[draft.color].hex }} aria-hidden="true" />
              颜色：{MOODS[draft.color].name}
            </span>
          )}
          {draft.milestone && <span class="entry-summary-item">里程碑：{draft.milestone}</span>}
          {draft.met && <span class="entry-summary-item">这周见到了</span>}
          {draft.emoji && <span class="entry-summary-item">表情标记：<span class="stored-emoji">{draft.emoji}</span></span>}
        </div>
      )}
      <button type="button" class="link-btn marker-toggle" aria-expanded={showMore} aria-controls={controlsId} onClick={() => setShowMore(!showMore)}>
        {showMore ? '收起颜色与标记 −' : '颜色与标记 ＋'}
      </button>
      <div class="entry-secondary" id={controlsId} hidden={!showMore}>
        <div class="milestone">
          <label class="field">
            <span>里程碑（可不填）</span>
            <input
              type="text"
              maxLength={40}
              placeholder="这周有什么值得记住的事"
              value={draft.milestone ?? ''}
              onInput={(e) => set({ milestone: (e.target as HTMLInputElement).value })}
            />
          </label>
          <div class="milestone-hints">
            {MILESTONE_HINTS[life.relation].map((h) => (
              <button type="button" key={h} class="text-option" onClick={() => set({ milestone: h })}>
                {h}
              </button>
            ))}
          </div>
        </div>
        {life.relation === 'parent' && (
          <label class="check">
            <input type="checkbox" checked={!!draft.met} onChange={(e) => set({ met: (e.target as HTMLInputElement).checked })} />
            这周见到了
          </label>
        )}
        <details class="marker-details">
          <summary>颜色 · {draft.color ? MOODS[draft.color].name : '默认颜色'}</summary>
          <div class="color-options" role="group" aria-label="颜色">
            <button type="button" aria-pressed={!draft.color} class={`color-option${!draft.color ? ' on' : ''}`} onClick={() => set({ color: undefined })}>
              <span class="color-circle none" aria-hidden="true" />
              <span>默认颜色</span>
            </button>
            {MOOD_KEYS.map((k) => (
              <button
                type="button"
                aria-pressed={draft.color === k}
                key={k}
                class={`color-option${draft.color === k ? ' on' : ''}`}
                onClick={() => set({ color: draft.color === k ? undefined : k })}
              >
                <span class="color-circle" style={{ background: MOODS[k].hex }} aria-hidden="true" />
                <span>{MOODS[k].name}</span>
              </button>
            ))}
          </div>
        </details>
        <details class="marker-details">
          <summary>表情标记 · {draft.emoji ? '已选' : '未选'}</summary>
          <div class="emoji-options" role="group" aria-label="表情标记">
            <button type="button" class={`text-option${!draft.emoji ? ' on' : ''}`} aria-pressed={!draft.emoji} onClick={() => set({ emoji: undefined })}>不使用</button>
            {EMOJIS.map((em) => (
              <button type="button" aria-pressed={draft.emoji === em} aria-label={`表情标记 ${em}`} key={em} class={`emoji-option${draft.emoji === em ? ' on' : ''}`} onClick={() => set({ emoji: draft.emoji === em ? undefined : em })}>
                {em}
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}

function toDraft(lifeId: string, weekId: number): EntryDraft {
  const e = getEntry(lifeId, weekId)
  return { text: e?.text, color: e?.color, emoji: e?.emoji, milestone: e?.milestone, met: e?.met }
}

/** Explicit save/cancel editor; the only way a tap on the grid can lead to a write. */
export function EntryEditor(props: { life: Life; weekId: number; onClose: () => void; onSaved?: () => void }) {
  const { life, weekId } = props
  const [draft, setDraft] = useState<EntryDraft>(() => toDraft(life.id, weekId))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const existed = !!getEntry(life.id, weekId)
  const active = useRef(true)
  const operation = useRef<symbol | null>(null)
  useLayoutEffect(() => () => { active.current = false; operation.current = null }, [])
  const close = () => {
    active.current = false
    operation.current = null
    props.onClose()
  }
  const save = async (d: EntryDraft) => {
    if (!active.current || operation.current) return
    const owner = operation.current = Symbol()
    const { onSaved, onClose } = props
    setBusy(true)
    try {
      await saveEntry(life.id, weekId, d)
      if (!active.current || operation.current !== owner) return
      active.current = false
      operation.current = null
      onSaved?.()
      onClose()
    } catch (err) {
      if (!active.current || operation.current !== owner) return
      operation.current = null
      setError(saveFailureMessage(err))
      setBusy(false)
    }
  }
  return (
    <Modal title="记下这一周" onClose={close}>
      <div class="entry-byline">
        <p class="entry-signature"><NameSignature name={life.name} /></p>
        <p class="entry-context">
          <span>{RELATION_LABEL[life.relation]}</span>
          <time dateTime={weekKey(weekId)}>{formatWeekRange(weekId)}</time>
          <span>第 {weekNumberSince(life.birthDate, weekId)} 周</span>
        </p>
      </div>
      <EntryFields life={life} draft={draft} onChange={setDraft} />
      {error && <div class="error">{error}</div>}
      <div class="row-btns">
        {existed && (
          <button type="button" class="btn ghost" disabled={busy} onClick={() => save({})}>
            清空这一周
          </button>
        )}
        <span class="spacer" />
        <button type="button" class="btn" onClick={close}>
          取消
        </button>
        <button type="button" class="btn primary" disabled={busy || (!existed && isEntryEmpty(draft))} onClick={() => save(draft)}>
          保存
        </button>
      </div>
    </Modal>
  )
}

export function TabBar(props: { active: 'home' | 'week' | 'together' | 'backup' }) {
  const tabs = [
    ['home', '家人', '/', '01'],
    ['week', '这一周', '/week', '02'],
    ['together', '一起', '/together', '03'],
    ['backup', '备份', '/backup', '04'],
  ] as const
  return (
    <nav class="page-index" aria-label="页签索引">
      {tabs.map(([key, label, path, number]) => (
        <button type="button" key={key} class={`page-index-tab${props.active === key ? ' on' : ''}`} aria-current={props.active === key ? 'page' : undefined} onClick={() => go(path)}>
          <span class="page-index-number" aria-hidden="true">{number}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

export function TopBar(props: { title: string; backTo?: string; right?: ComponentChildren }) {
  return (
    <header class="topbar document-topbar">
      {props.backTo !== undefined && (
        <button type="button" class="topbar-back" aria-label="返回" onClick={() => go(props.backTo!)}>
          <span aria-hidden="true">‹</span>
          <span>返回</span>
        </button>
      )}
      <h1 class="topbar-title">{props.title}</h1>
      {props.right && <div class="topbar-right">{props.right}</div>}
    </header>
  )
}
