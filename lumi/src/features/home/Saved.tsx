import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Bell, Bookmark, Check, ChefHat, Circle, ClipboardList, House, Plus, Trash2 } from 'lucide-react'
import type { SavedItem } from '../../api/types'
import { useApp } from '../../store/AppStore'
import { Badge, Button, Chip, IconButton, useToast } from '../../ui'
import { createVelocityTracker, haptic, lockAxis, prefersReducedMotion, swipeCommit, swipeOffset, swipeThreshold } from '../../ui/gesture'
import styles from './saved.module.css'

function SavedRow({ item, timeZoneLabel, onToggle, onRemove }: {
  item: SavedItem; timeZoneLabel: string; onToggle: () => void; onRemove: () => void
}) {
  const foreground = useRef<HTMLDivElement>(null)
  const action = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ id: number; x: number; y: number; width: number; axis: 'x' | null; dx: number; armed: boolean } | null>(null)
  const velocity = useRef(createVelocityTracker())
  const suppressClick = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const [removing, setRemoving] = useState(false)
  const Icon = item.kind === 'reminder' ? Bell : item.kind === 'recipe' ? ChefHat : item.kind === 'hotel' ? House : item.kind === 'task' ? ClipboardList : Bookmark
  useEffect(() => () => clearTimeout(timer.current), [])

  function reset() {
    gesture.current = null
    if (foreground.current) {
      foreground.current.style.transition = prefersReducedMotion() ? 'none' : ''
      foreground.current.style.removeProperty('transform')
    }
    action.current?.style.removeProperty('opacity')
  }

  return <div className={styles.swipeRow} data-saved-row={item.id}>
    <div ref={action} className={styles.swipeAction} aria-hidden="true">
      <span className={styles.swipeComplete}><Check size={18} />{item.done ? '取消完成' : '完成'}</span>
      <span className={styles.swipeRemove}><Trash2 size={18} />移除</span>
    </div>
    <div ref={foreground} className={`${styles.item} ${item.done ? styles.completed : ''}`}
      onPointerDown={event => {
        suppressClick.current = false
        if (removing || event.pointerType !== 'touch' || !event.isPrimary || event.clientX < 16 || innerWidth - event.clientX < 16) return
        if ((event.target as Element).closest('button, a, input, textarea')) return
        gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, width: event.currentTarget.offsetWidth, axis: null, dx: 0, armed: false }
        velocity.current.reset()
        velocity.current.add(0, event.timeStamp)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        const drag = gesture.current
        if (!drag || drag.id !== event.pointerId) return
        const dx = event.clientX - drag.x
        if (!drag.axis) {
          const axis = lockAxis(dx, event.clientY - drag.y)
          if (!axis) return
          if (axis === 'y') { reset(); return }
          drag.axis = 'x'
          suppressClick.current = true
          event.currentTarget.style.transition = 'none'
        }
        drag.dx = dx
        velocity.current.add(dx, event.timeStamp)
        event.currentTarget.style.transform = `translateX(${swipeOffset(dx, drag.width)}px)`
        if (action.current) action.current.style.opacity = dx === 0 ? '0' : '1'
        const crossed = Math.abs(dx) >= swipeThreshold(drag.width, dx > 0 ? 'start' : 'end')
        if (crossed && !drag.armed) haptic()
        drag.armed = crossed
      }}
      onPointerUp={event => {
        const drag = gesture.current
        if (!drag || drag.id !== event.pointerId) return
        velocity.current.add(drag.dx, event.timeStamp)
        const commit = drag.axis && swipeCommit(drag.dx, velocity.current.velocity(), drag.width)
        if (commit === 'end') {
          gesture.current = null
          setRemoving(true)
          event.currentTarget.style.transition = prefersReducedMotion() ? 'none' : ''
          event.currentTarget.style.transform = 'translateX(-100%)'
          if (prefersReducedMotion()) onRemove()
          else timer.current = setTimeout(onRemove, 180)
        } else {
          reset()
          if (commit === 'start') onToggle()
        }
      }}
      onPointerCancel={reset}
      onLostPointerCapture={() => { if (gesture.current) reset() }}
      onClickCapture={event => {
        if ((suppressClick.current && event.detail > 0) || removing) { event.preventDefault(); event.stopPropagation() }
      }}>
      <button className={styles.check} disabled={removing} aria-label={item.done ? `标记未完成：${item.title}` : `标记完成：${item.title}`} aria-pressed={item.done} onClick={onToggle}>{item.done ? <Check size={18} /> : <Circle size={19} />}</button>
      <div className={styles.itemText}><h2>{item.title}</h2><p>{item.detail}</p>{item.dueAt && <span className={styles.due}><Bell size={12} /><span>{new Date(item.dueAt).toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}（{timeZoneLabel}）{new Date(item.dueAt).getTime() < Date.now() && !item.done ? ' · 已到期' : ''}</span></span>}</div>
      <span className={styles.kindIcon} aria-hidden="true"><Icon size={17} /></span>
      <IconButton disabled={removing} aria-label={`移除：${item.title}`} onClick={onRemove}><Trash2 size={16} /></IconButton>
    </div>
  </div>
}

export function Saved() {
  const { state, dispatch } = useApp()
  const savedRef = useRef(state.saved)
  savedRef.current = state.saved
  const { toast, undo } = useToast()
  const [filter, setFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [localTime, setLocalTime] = useState('')
  const [error, setError] = useState<{ field: 'title' | 'detail' | 'time'; text: string } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const detailRef = useRef<HTMLTextAreaElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const openerRef = useRef<HTMLButtonElement | null>(null)
  const formId = useId()
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timeZoneLabel = deviceTimeZone ? `当前设备时区：${deviceTimeZone}` : '当前设备时区'
  const items = state.saved.filter(item => filter === 'all' || (filter === 'reminder' ? item.kind === 'reminder' : item.kind !== 'reminder'))

  useEffect(() => {
    if (formOpen) titleRef.current?.focus()
  }, [formOpen])

  function openForm(event: MouseEvent<HTMLButtonElement>) {
    openerRef.current = event.currentTarget
    if (formOpen) titleRef.current?.focus()
    else setFormOpen(true)
  }

  function cancelForm() {
    setFormOpen(false)
    setError(null)
    openerRef.current?.focus()
  }

  function showError(field: 'title' | 'detail' | 'time', text: string) {
    setError({ field, text })
    const ref = field === 'title' ? titleRef : field === 'detail' ? detailRef : timeRef
    ref.current?.focus()
  }

  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || trimmedTitle.length > 80) {
      showError('title', '请填写事项，去除首尾空格后须为 1–80 个字符。')
      return
    }
    if (detail.length > 300) {
      showError('detail', '备注不能超过 300 个字符。')
      return
    }
    let dueAt: string | undefined
    if (timeRef.current?.validity.badInput) {
      showError('time', '日期与时间无效，请填写完整、有效的日期与时间。')
      return
    }
    if (localTime) {
      const parts = /^(\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localTime)
      const date = new Date(localTime)
      const matchesInput = parts && Number.isFinite(date.getTime())
        && [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]
          .every((part, index) => part === Number(parts[index + 1]))
      if (!matchesInput) {
        showError('time', '日期与时间无效，或该时刻因夏令时切换不存在，请重新选择。')
        return
      }
      if (date.getTime() <= Date.now()) {
        showError('time', '请选择未来的日期与时间，不能选择过去或当前时刻。')
        return
      }
      dueAt = date.toISOString()
    }
    const item: SavedItem = {
      id: crypto.randomUUID(),
      kind: dueAt ? 'reminder' : 'task',
      title: trimmedTitle,
      detail: detail.trim(),
      done: false,
      createdAt: new Date().toISOString(),
      ...(dueAt ? { dueAt } : {}),
    }
    dispatch({ type: 'save', item })
    setTitle('')
    setDetail('')
    setLocalTime('')
    setError(null)
    setFormOpen(false)
    setFilter('all')
    toast('已保存到本地清单，不会发送后台通知')
    openerRef.current?.focus()
  }

  function removeItem(id: string) {
    const index = savedRef.current.findIndex(item => item.id === id)
    const item = savedRef.current[index]
    if (!item) return
    dispatch({ type: 'remove', id })
    undo(`已移除「${item.title}」`, () => dispatch({ type: 'restore', item, index }))
  }
  return <div className={styles.saved}>
    <div className={styles.heading}><h1>清单</h1><Badge tone="neutral">本机保存</Badge></div>
    <div className={styles.filter}><Chip selected={filter === 'all'} onClick={() => setFilter('all')}>全部 {state.saved.length}</Chip><Chip selected={filter === 'reminder'} onClick={() => setFilter('reminder')}>提醒</Chip><Chip selected={filter === 'saved'} onClick={() => setFilter('saved')}>收藏与待办</Chip><Button variant="ghost" size="sm" aria-expanded={formOpen} aria-controls={formId} onClick={openForm}><Plus size={15} />添加小事</Button></div>
    <form id={formId} className={styles.form} hidden={!formOpen} noValidate onSubmit={saveItem} aria-labelledby={`${formId}-heading`}>
      <h2 id={`${formId}-heading`}>记一件小事</h2>
      <div className={styles.field}>
        <label htmlFor={`${formId}-title`}>事项（必填）</label>
        <input ref={titleRef} id={`${formId}-title`} name="title" required maxLength={80} value={title} onChange={event => { setTitle(event.target.value); setError(null) }} aria-invalid={error?.field === 'title'} aria-describedby={error?.field === 'title' ? `${formId}-error` : undefined} />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${formId}-detail`}>备注</label>
        <textarea ref={detailRef} id={`${formId}-detail`} name="detail" rows={3} maxLength={300} value={detail} onChange={event => { setDetail(event.target.value); setError(null) }} aria-invalid={error?.field === 'detail'} aria-describedby={`${formId}-detail-hint${error?.field === 'detail' ? ` ${formId}-error` : ''}`} />
        <p id={`${formId}-detail-hint`} className={styles.formHint}>选填，最多 300 个字符。</p>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${formId}-time`}>日期与时间（可选）</label>
        <input ref={timeRef} id={`${formId}-time`} name="dueAt" type="datetime-local" step={60} value={localTime} onChange={event => { setLocalTime(event.target.value); setError(null) }} aria-invalid={error?.field === 'time'} aria-describedby={`${formId}-time-hint${error?.field === 'time' ? ` ${formId}-error` : ''}`} />
        <p id={`${formId}-time-hint`} className={styles.formHint}>按当前设备时区{deviceTimeZone ? `（${deviceTimeZone}）` : ''}保存与显示；留空记为待办，填写未来时间记为本地提醒。夏令时重复时刻按设备默认解析。</p>
      </div>
      {error && <p id={`${formId}-error`} className={styles.formError} role="alert">{error.text}</p>}
      <div className={styles.formActions}><Button variant="secondary" onClick={cancelForm}>取消</Button><Button type="submit">保存到本地</Button></div>
    </form>
    {items.length ? <><p className={styles.gestureHint}>左滑移除 · 右滑完成，也可点击按钮操作</p><div className={styles.list}>{items.map(item => <SavedRow key={item.id} item={item} timeZoneLabel={timeZoneLabel} onToggle={() => dispatch({ type: 'toggle', id: item.id })} onRemove={() => removeItem(item.id)} />)}</div></> : <div className={styles.empty}><h2>暂无事项</h2><p>在这里记下待办或本地提醒，<br />也可以在对话里收藏餐厅、住宿或菜谱。</p><Button variant="secondary" aria-expanded={formOpen} aria-controls={formId} onClick={openForm}><Plus size={16} />记一件小事</Button></div>}
    <p className={styles.privacy}><Bell size={13} />提醒只加入本地清单，不会创建系统闹钟或发送后台通知。数据仅保存在当前浏览器。</p>
  </div>
}
