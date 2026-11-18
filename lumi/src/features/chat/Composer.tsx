import { useLayoutEffect, useRef } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import styles from './chat.module.css'

export function Composer({ busy, draft, onDraft, onSend, onStop }: {
  busy: boolean; draft: string; onDraft: (draft: string) => void
  onSend: (query: string) => boolean; onStop: () => void
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const resize = () => {
      if (!input.current) return
      input.current.style.height = '24px'
      input.current.style.height = `${Math.min(input.current.scrollHeight, 168, (window.visualViewport?.height ?? innerHeight) * .25)}px`
    }
    resize()
    window.visualViewport?.addEventListener('resize', resize)
    window.addEventListener('resize', resize)
    return () => { window.visualViewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize) }
  }, [draft])
  const submit = () => {
    if (busy || !draft.trim()) return
    if (onSend(draft.trim())) onDraft('')
  }
  return <div className={styles.composerDock}>
    <form className={styles.composer} onSubmit={e => { e.preventDefault(); submit() }} onPointerDown={e => { if (e.target === e.currentTarget) { e.preventDefault(); input.current?.focus() } }}>
      <textarea ref={input} value={draft} onChange={e => onDraft(e.target.value)} maxLength={2000} rows={1}
        aria-label="向 Lumi 提问" placeholder="问问 Lumi"
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia('(min-width: 768px)').matches) {
            e.preventDefault(); submit()
          }
        }} />
      <button type={busy ? 'button' : 'submit'} className={styles.send} disabled={!busy && !draft.trim()}
        aria-label={busy ? '停止生成' : '发送消息'} onClick={busy ? onStop : undefined}>
        <span className={styles.sendDot}>{busy ? <Square size={12} fill="currentColor" strokeWidth={0} /> : <ArrowUp size={19} strokeWidth={2.25} />}</span>
      </button>
    </form>
    <p className={styles.composerFooter}>内容为模拟数据，仅供体验</p>
  </div>
}
