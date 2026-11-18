import type { ComponentChildren } from 'preact'
import { ageOn, formatWeekRange, fromDay, mondayDayOfWeek, weekNumberSince } from '../lib/date'
import { RELATION_LABEL, derivedMarks, isEntryEmpty, lastLivedWeek, birthWeek, moodHex, themeHex, type Life } from '../lib/model'
import { getEntry } from '../state/store'

export function inLife(life: Life, weekId: number, currentWeek: number) {
  return weekId >= birthWeek(life) && weekId <= lastLivedWeek(life, currentWeek)
}

function weekAge(life: Life, weekId: number) {
  const n = weekNumberSince(life.birthDate, weekId)
  const sunday = fromDay(mondayDayOfWeek(weekId) + 6)
  const years = Math.max(0, ageOn(life.birthDate, sunday))
  return life.relation === 'child' && years < 3 ? `第 ${n} 周` : `第 ${n} 周 · ${years} 岁`
}

export function EntryBlock(props: { life: Life; all: Life[]; weekId: number; currentWeek: number; onWrite?: (lifeId: string) => void; showName: boolean; heading?: ComponentChildren; primary?: boolean }) {
  const { life, weekId } = props
  const e = getEntry(life.id, weekId)
  const marks = derivedMarks(life, props.all).filter((m) => m.weekId === weekId)
  const has = e && !isEntryEmpty(e)
  const writable = inLife(life, weekId, props.currentWeek) && props.onWrite
  const action = writable && (
    <button type="button" class={`btn ${props.primary ? 'primary' : 'small'}`} onClick={() => props.onWrite!(life.id)}>
      {has ? '改这一周' : props.showName ? `写 ${life.name} 的这一周` : '写这一周'}
    </button>
  )
  return (
    <div class="sheet-entry">
      <div class="sheet-entry-head">
        {props.heading ?? <span class="who"><span class="swatch sm" style={{ background: themeHex(life.color) }} />{life.name}<span class="relation">{RELATION_LABEL[life.relation]}</span></span>}
        <span class="muted">{inLife(life, weekId, props.currentWeek) ? weekAge(life, weekId) : '不在这一周'}</span>
      </div>
      {props.primary && action}
      {marks.map((m) => (
        <div class="mark" key={m.label}>
          ◆ {m.label}
        </div>
      ))}
      {e?.milestone && <div class="mark">◆ {e.milestone}</div>}
      {has ? (
        <p class="said">
          {e!.color && <span class="swatch sm" style={{ background: moodHex(e!.color) }} />}
          {e!.emoji && <span class="em">{e!.emoji}</span>}
          {e!.text ?? ''}
          {e!.met && <span class="tag static">见到了</span>}
        </p>
      ) : (
        inLife(life, weekId, props.currentWeek) && <p class="said empty">这一周还空着</p>
      )}
      {!props.primary && action}
    </div>
  )
}

export function WeekSheet(props: {
  weekId: number
  currentWeek: number
  lives: Life[]
  all: Life[]
  /** lives whose non-empty entries are shown as "同一周" context */
  others?: Life[]
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
  onClose?: () => void
  onWrite: (lifeId: string) => void
  note?: string
}) {
  const { weekId, currentWeek } = props
  const others = (props.others ?? []).filter((l) => {
    const e = getEntry(l.id, weekId)
    return e && !isEntryEmpty(e)
  })
  return (
    <section class="sheet" aria-label={`${formatWeekRange(weekId)} 这一周`}>
      <div class="sheet-head">
        <button type="button" class="icon-btn" aria-label="上一周" disabled={!props.canPrev} onClick={props.onPrev}>
          ‹
        </button>
        <div class="sheet-title">
          {formatWeekRange(weekId)}
          {weekId === currentWeek && <span class="tag static now">这一周</span>}
        </div>
        <button type="button" class="icon-btn" aria-label="下一周" disabled={!props.canNext} onClick={props.onNext}>
          ›
        </button>
        {props.onClose && <button type="button" class="icon-btn" aria-label="关闭" onClick={props.onClose}>×</button>}
      </div>
      <div class="sheet-body">
        {weekId > currentWeek ? (
          <p class="said empty">还没有到来的一周。</p>
        ) : (
          props.lives.map((l) => (
            <EntryBlock key={l.id} life={l} all={props.all} weekId={weekId} currentWeek={currentWeek} onWrite={props.onWrite} showName={props.lives.length > 1} />
          ))
        )}
        {props.note && <p class="sheet-note">{props.note}</p>}
        {others.length > 0 && (
          <div class="others">
            <div class="muted small-title">同一周</div>
            {others.map((l) => {
              const e = getEntry(l.id, weekId)!
              return (
                <div class="other" key={l.id}>
                  <span class="swatch sm" style={{ background: themeHex(l.color) }} />
                  <b>{l.name}</b> {e.emoji} {e.text ?? e.milestone ?? (e.met ? '见到了' : '')}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
