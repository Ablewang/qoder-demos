import { useId, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { sameEntry } from '../db/db'
import { isoWeekLabel } from '../lib/copy'
import { formatWeekRange, weekKey, weekNumberSince } from '../lib/date'
import { MOODS, RELATION_LABEL, birthWeek, themeHex, type Life, type WeekEntry } from '../lib/model'
import { go } from '../router'
import { getEntry, saveEntry, useAppState, type EntryDraft } from '../state/store'
import { EntryFields, NameSignature, TabBar } from '../ui/ui'
import { inLife } from './WeekSheet'

function draftOf(e: WeekEntry | undefined): EntryDraft {
  return { text: e?.text, color: e?.color, emoji: e?.emoji, milestone: e?.milestone, met: e?.met }
}

function matchesDraft(e: WeekEntry | undefined, d: EntryDraft) {
  return (e?.text ?? '') === (d.text ?? '').trim() && e?.color === d.color
    && e?.emoji === d.emoji && (e?.milestone ?? '') === (d.milestone ?? '').trim()
    && !!e?.met === !!d.met
}

function WeekRow(props: { life: Life; weekId: number }) {
  const { life, weekId } = props
  const entry = getEntry(life.id, weekId)
  const [draft, setDraft] = useState(() => draftOf(entry))
  const [status, setStatus] = useState<'' | 'pending' | 'saved' | 'error'>('')
  const [conflict, setConflict] = useState<{ entry: WeekEntry | undefined } | null>(null)
  const active = useRef(true)
  const version = useRef(0)
  const latest = useRef(draft)
  const baseline = useRef(entry)
  const observed = useRef(entry)
  const dirty = useRef(false)
  const blocked = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const statusId = useId()
  const pending = useRef<{ draft: EntryDraft; version: number } | null>(null)
  const saving = useRef<{ draft: EntryDraft; version: number } | null>(null)

  const pause = (incoming: WeekEntry | undefined) => {
    clearTimeout(timer.current)
    blocked.current = true
    if (active.current) { setConflict({ entry: incoming }); setStatus('') }
  }

  const flush = async () => {
    clearTimeout(timer.current)
    if (saving.current || blocked.current || !pending.current) return
    const operation = saving.current = pending.current
    pending.current = null
    try {
      const result = await saveEntry(life.id, weekId, operation.draft, { expected: baseline.current })
      if (result.conflict) {
        pause(result.entry)
      } else {
        baseline.current = result.entry
        if (!blocked.current && version.current === operation.version) {
          dirty.current = false
          if (active.current) setStatus('saved')
        }
      }
    } catch {
      if (!blocked.current && version.current === operation.version && active.current) setStatus('error')
    } finally {
      saving.current = null
      if (blocked.current && active.current) setConflict((current) => current && { ...current })
      if (pending.current && !blocked.current) {
        if (active.current) timer.current = setTimeout(() => void flush(), 600)
        else void flush()
      }
    }
  }

  useLayoutEffect(() => {
    if (sameEntry(entry, observed.current)) return
    observed.current = entry
    if (sameEntry(entry, baseline.current)) return
    if (saving.current && matchesDraft(entry, saving.current.draft)) {
      baseline.current = entry
    } else if (dirty.current) {
      pause(entry)
    } else {
      baseline.current = entry
      latest.current = draftOf(entry)
      setDraft(latest.current)
      setStatus('')
    }
  }, [entry])

  useLayoutEffect(() => () => { active.current = false; clearTimeout(timer.current); void flush() }, [])

  const onChange = (d: EntryDraft) => {
    latest.current = d
    setDraft(d)
    dirty.current = true
    pending.current = { draft: d, version: ++version.current }
    clearTimeout(timer.current)
    if (!blocked.current) {
      setStatus('pending')
      timer.current = setTimeout(() => void flush(), 600)
    }
  }

  const resolve = (keepDraft: boolean) => {
    if (!conflict || saving.current) return
    baseline.current = conflict.entry
    blocked.current = false
    setConflict(null)
    if (keepDraft) {
      onChange(latest.current)
    } else {
      ++version.current
      dirty.current = false
      pending.current = null
      latest.current = draftOf(conflict.entry)
      setDraft(latest.current)
      setStatus('')
    }
  }

  return (
    <li class="week-row journal-row">
      <div class="week-row-head">
        <div class="week-byline">
          <button type="button" class="week-signature" onClick={() => go(`/life/${life.id}?w=${weekId}`)}>
            <span class="color-circle" style={{ background: themeHex(life.color) }} aria-hidden="true" />
            <span><NameSignature name={life.name} /></span>
          </button>
          <div class="week-row-context">
            <span class="week-relation">{RELATION_LABEL[life.relation]}</span>
            <span>第 {weekNumberSince(life.birthDate, weekId)} 周</span>
          </div>
        </div>
      </div>
      <EntryFields life={life} draft={draft} onChange={onChange} compact statusId={statusId} status={
        <span id={statusId} class={`save-status ${conflict ? 'paused' : status}`} role="status" aria-live="polite">
          {conflict ? '自动保存已暂停' : status === 'pending' ? '正在自动保存…' : status === 'saved' ? '已自动保存' : status === 'error' ? '未保存，请重新编辑后重试' : '停笔后自动保存'}
        </span>
      } />
      {conflict && <div class="draft-conflict notice warn" role="alert">
        <p>本机这一周已在别处修改，自动保存已暂停。上面的草稿仍在，请选择保留哪一份。</p>
        <p class="conflict-record">本机记录：{conflict.entry ? [conflict.entry.text, conflict.entry.milestone, conflict.entry.emoji, conflict.entry.color && `颜色：${MOODS[conflict.entry.color].name}`, conflict.entry.met && '这周见到了'].filter(Boolean).join(' · ') : '这一周已清空。'}</p>
        <div class="row-btns">
          <button type="button" class="btn" disabled={!!saving.current} onClick={() => resolve(false)}>采用本机记录</button>
          <button type="button" class="btn" disabled={!!saving.current} onClick={() => resolve(true)}>用草稿覆盖</button>
        </div>
      </div>}
    </li>
  )
}

export function WeekPage(props: { week?: number }) {
  const st = useAppState()
  const { lives, currentWeek } = st
  const weekId = props.week !== undefined && props.week <= currentWeek ? props.week : currentWeek
  const present = lives.filter((l) => inLife(l, weekId, currentWeek))
  const earliest = lives.length ? Math.min(...lives.map(birthWeek)) : currentWeek
  const nav = (wk: number) => go(wk === currentWeek ? '/week' : `/week?w=${wk}`)

  return (
    <div class="page week-page">
      <header class="week-head axis-week-head">
        <div class="week-axis-heading">
          <h1>{weekId === currentWeek ? '这一周' : isoWeekLabel(weekId)}</h1>
          <p class="sub"><time dateTime={weekKey(weekId)}>{formatWeekRange(weekId)}</time></p>
        </div>
        <nav class="week-axis-nav" aria-label="按周翻页">
          <button type="button" class="week-nav-button" aria-label="上一周" disabled={weekId <= earliest} onClick={() => nav(weekId - 1)}>
            <span aria-hidden="true">‹</span> 上一周
          </button>
          <button type="button" class="week-nav-button" aria-label="下一周" disabled={weekId >= currentWeek} onClick={() => nav(weekId + 1)}>
            下一周 <span aria-hidden="true">›</span>
          </button>
        </nav>
      </header>
      {weekId !== currentWeek && (
        <button type="button" class="link-btn pad" onClick={() => nav(currentWeek)}>
          回到这一周
        </button>
      )}
      {lives.length === 0 ? (
        <p class="muted pad">
          还没有人。<button type="button" class="link-btn" onClick={() => go('/person/new')}>先添加一个人</button>
        </p>
      ) : present.length === 0 ? (
        <p class="muted pad">这一周还没有人来到世上。</p>
      ) : (
        <>
          <p class="muted pad week-intro">一家人的这一周，一人一句。停笔后会自动保存在本机，请留意每条记录的保存状态。</p>
          <ul class="week-list">
            {present.map((l) => (
              <WeekRow key={`${l.id}:${weekId}`} life={l} weekId={weekId} />
            ))}
          </ul>
        </>
      )}
      <TabBar active="week" />
    </div>
  )
}
