import { useMemo, useState } from 'preact/hooks'
import { GridCanvas, type Flash, type Selection } from '../grid/GridCanvas'
import { locateWeek, personalLayout } from '../grid/layout'
import { personalStyle, usePalette } from '../grid/styles'
import { DEFAULT_COMPANION, estimateCompanion } from '../lib/companion'
import { ageLabel, fmt } from '../lib/copy'
import { checkPastDate, formatWeekRange, isoYearOfWeek, weekIdOf, weekKey } from '../lib/date'
import { RELATION_LABEL, birthWeek, effectiveShowFuture, lastLivedWeek, themeHex, type Companion, type Life } from '../lib/model'
import { go } from '../router'
import { saveFailureMessage, saveLife, useAppState } from '../state/store'
import { EntryEditor, NameSignature, Stepper, TabBar, TopBar } from '../ui/ui'
import { EntryBlock, WeekSheet } from './WeekSheet'

function CompanionCard(props: { life: Life; today: string; metThisYear: number }) {
  const { life, today } = props
  const [tuning, setTuning] = useState(false)
  const [saveError, setSaveError] = useState('')
  const c: Companion = life.companion ?? DEFAULT_COMPANION
  const update = (patch: Partial<Life>) => {
    setSaveError('')
    void saveLife({ ...life, ...patch }).catch((err) => setSaveError(saveFailureMessage(err)))
  }
  const setC = (patch: Partial<Companion>) => update({ companion: { ...c, ...patch } })

  if (!life.companionOn) {
    return (
      <section class="companion off">
        <p class="muted small">可选的陪伴假设：按你填的次数和年龄换算，不是预测，随时可以关掉。</p>
        <button
          type="button"
          class="btn small"
          onClick={() => {
            setTuning(true)
            update({ companionOn: true, companion: c })
          }}
        >
          按我的假设算一算
        </button>
        {saveError && <p class="error" role="alert">{saveError}</p>}
      </section>
    )
  }

  const toAge = c.toAge
  const r = estimateCompanion(life.birthDate, today, c)
  return (
    <section class="card companion">
      <div class="companion-head">
        <b>按你的假设</b>
        <span>
          <button type="button" class="link-btn" aria-expanded={tuning} onClick={() => setTuning(!tuning)}>
            {tuning ? '收起' : '调整假设'}
          </button>
          <span class="muted"> · </span>
          <button type="button" class="link-btn" onClick={() => update({ companionOn: false })}>
            关掉
          </button>
        </span>
      </div>
      {tuning && (
        <>
          <label class="check">
            <input type="checkbox" checked={c.livesTogether} onChange={(e) => setC({ livesTogether: (e.target as HTMLInputElement).checked })} />
            我们住在一起
          </label>
          {!c.livesTogether && (
            <>
              <Stepper label="一年大约见几次" value={c.meetPerYear} min={0} max={365} unit="次" onChange={(n) => setC({ meetPerYear: n })} />
              <Stepper label="每次大约几天" value={c.daysPerMeet} min={1} max={60} unit="天" onChange={(n) => setC({ daysPerMeet: n })} />
              <Stepper label="算到 TA 多少岁" value={toAge} min={1} max={130} unit="岁" onChange={(n) => setC({ toAge: n })} />
            </>
          )}
        </>
      )}
      <div class="companion-result" aria-live="polite">
        {r.kind === 'together' && <p>你们住在一起，日子不用算。把普通的这一周记下来就好。</p>}
        {r.kind === 'beyond' && <p>按这组假设算不出一个数字。真实的日子没有人知道，不必让一个数字来决定。</p>}
        {r.kind === 'estimate' && (
          <>
            <p>
              按 每年 {c.meetPerYear} 次、每次 {c.daysPerMeet} 天、算到 {toAge} 岁 来换算，大约还能再见 <b>{fmt(r.meets)}</b> 次，约 {fmt(r.days)} 天。
            </p>
            {r.meets <= 160 && (
              <div class="dots" aria-hidden="true">
                {Array.from({ length: r.meets }, (_, i) => (
                  <i key={i} style={{ background: themeHex(life.color) }} />
                ))}
              </div>
            )}
          </>
        )}
        <p class="muted small">这只是一个粗略的换算，不是预测；改动上面的假设，数字会跟着变。</p>
        {props.metThisYear > 0 && <p class="muted small">今年你在格子里标记了 {props.metThisYear} 次「见到了」。</p>}
      </div>
      {saveError && <p class="error" role="alert">{saveError}</p>}
    </section>
  )
}

export function LifePage(props: { id: string; week?: number }) {
  const st = useAppState()
  const { lives, today, currentWeek } = st
  const life = lives.find((l) => l.id === props.id)
  const pal = usePalette()
  const [sel, setSel] = useState<Selection>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [flash, setFlash] = useState<Flash>(null)
  const [locateDate, setLocateDate] = useState('')
  const [locateError, setLocateError] = useState('')
  const entries = life ? st.entries.get(life.id) : undefined

  const layout = useMemo(() => (life ? personalLayout(life, today) : null), [life, today])
  const cellStyle = useMemo(() => (life ? personalStyle(life, lives, entries, pal) : null), [life, lives, entries, pal])

  if (!st.ready) return <div class="page" />
  if (!life || !layout || !cellStyle) {
    return (
      <div class="page">
        <TopBar title="找不到这个人" backTo="/" />
        <p class="muted pad">TA 可能已经被删除了。</p>
      </div>
    )
  }

  const lived = lastLivedWeek(life, currentWeek)
  const focusWeek = props.week !== undefined && locateWeek(layout, props.week, life.id) ? props.week : lived
  const metThisYear = entries ? [...entries].filter(([wk, e]) => e.met && isoYearOfWeek(wk) === isoYearOfWeek(currentWeek)).length : 0
  const selWeek = sel?.weekId ?? focusWeek
  const canGo = (wk: number) => wk <= lived && !!locateWeek(layout, wk, life.id)
  const locate = (e: Event) => {
    e.preventDefault()
    const check = checkPastDate(locateDate, today)
    if (!check.ok) { setLocateError(check.reason); return }
    const wk = weekIdOf(locateDate)
    if (!canGo(wk)) { setLocateError('请选择这张时间页里的日期'); return }
    setLocateError('')
    setSel({ lifeId: life.id, weekId: wk })
  }

  return (
    <div class="page life-page" style={{ '--person-ink': themeHex(life.color) }}>
      <TopBar
        title="时间页"
        backTo="/"
        right={
          <button type="button" class="btn small ghost" onClick={() => go(`/person/${life.id}/edit`)}>
            编辑
          </button>
        }
      />
      <header class="life-identity"><h1><NameSignature name={life.name} /></h1><p class="relation">{RELATION_LABEL[life.relation]} · {ageLabel(life, today)}{life.endDate ? ' · 已离开' : ''}</p><p class="sub">{life.birthDate.replaceAll('-', '.')} 出生{life.endDate && <> — {life.endDate.replaceAll('-', '.')} 离开</>}</p></header>
      <section class="this-week" aria-label={life.endDate ? '最后一周的记录' : '这一周的记录'}>
        <EntryBlock life={life} all={lives} weekId={lived} currentWeek={currentWeek} onWrite={() => setEditing(lived)} showName={false} primary heading={<span class="this-week-title"><b>{life.endDate ? '最后一周' : '这一周'}</b><time dateTime={weekKey(lived)}>{formatWeekRange(lived)}</time></span>} />
      </section>
      <div class="weave-tools"><h2>总览 · 一岁一行</h2><details class="locate-menu"><summary>定位日期</summary><form onSubmit={locate}><label class="field"><span>时间页里的日期</span><input type="date" min={life.birthDate} max={life.endDate ?? today} value={locateDate} onInput={(e) => setLocateDate((e.target as HTMLInputElement).value)} /></label>{locateError && <p class="error" role="alert">{locateError}</p>}<button type="submit" class="btn">定位</button></form><button type="button" class="link-btn" onClick={() => setSel({ lifeId: life.id, weekId: birthWeek(life) })}>出生那一周</button><button type="button" class="link-btn" onClick={() => setSel({ lifeId: life.id, weekId: lived })}>{life.endDate ? '最后一周' : '回到当前周'}</button></details></div>
      <div class="time-position"><span>{selWeek === currentWeek ? '当前周' : '所选周'}</span><span>{formatWeekRange(selWeek)}</span></div>

      <div class="legend" aria-hidden="true">
        <span>
          <i style={{ background: themeHex(life.color) }} />
          写过
        </span>
        <span>
          <i style={{ background: pal.past }} />
          未记
        </span>
        {effectiveShowFuture(life) && (
          <span>
            <i class="hollow" />
            未来
          </span>
        )}
        <span>
          <i class="ring" />
          里程碑
        </span>
        <span class="muted">一格一周</span>
      </div>

      {effectiveShowFuture(life) && <p class="range-note">未来空格画到 {layout.strips.length} 岁，仅作显示范围，不是寿命预测。可在编辑中关闭。</p>}
      <GridCanvas
        layout={layout}
        gutter={34}
        overview
        initialZoom={1}
        cellStyle={cellStyle}
        currentWeek={currentWeek}
        accent={() => themeHex(life.color)}
        selected={sel ?? { lifeId: life.id, weekId: focusWeek }}
        onSelect={(hit) => setSel(hit ? { lifeId: life.id, weekId: hit.weekId } : null)}
        onActivate={() => selWeek !== undefined && selWeek <= lived && setEditing(selWeek)}
        focus={{ weekId: selWeek, lifeId: life.id }}
        flash={flash}
        ariaLabel={`${life.name}的格子，每行是一岁，每格是一周`}
      />

      <p class="grid-caption">{life.relation === 'child' ? '只画已走过的周，不画未来。' : `已走过 ${fmt(lived - birthWeek(life) + 1)} 周。`} 每行从生日所在周开始，完整行是 52 或 53 周。</p>
      <WeekSheet weekId={selWeek} currentWeek={currentWeek} lives={selWeek === lived ? [] : [life]} note={selWeek === lived ? `${life.endDate ? '最后一周' : '这一周'}的记录在页首。点格子，或用 ‹ › 翻看别的周。` : undefined} all={lives} others={lives.filter(l => l.id !== life.id)} canPrev={canGo(selWeek - 1)} canNext={canGo(selWeek + 1)} onPrev={() => setSel({ lifeId: life.id, weekId: selWeek - 1 })} onNext={() => setSel({ lifeId: life.id, weekId: selWeek + 1 })} onClose={sel ? () => setSel(null) : undefined} onWrite={() => setEditing(selWeek)} />
      {life.relation === 'child' && (
        <section class="recent-weeks">
          <h2 class="h2">最近记下的成长</h2>
          {entries?.size ? (
            <ul>
              {[...entries].sort(([a], [b]) => b - a).slice(0, 3).map(([wk, entry]) => (
                <li key={wk}>
                  <button type="button" class="recent-week" onClick={() => setSel({ lifeId: life.id, weekId: wk })}>
                    <span class="muted small">{formatWeekRange(wk)}</span>
                    <span>{[entry.emoji, entry.milestone, entry.text].filter(Boolean).join(' · ') || '记下了这一周的颜色'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p class="muted small">不必补满，从记得的一周写起就好。</p>}
        </section>
      )}
      {life.relation === 'parent' && !life.endDate && <CompanionCard life={life} today={today} metThisYear={metThisYear} />}

      <TabBar active="home" />

      {editing !== null && (
        <EntryEditor
          key={`${life.id}:${editing}`}
          life={life}
          weekId={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setSel({ lifeId: life.id, weekId: editing })
            setFlash({ lifeId: life.id, weekId: editing, at: performance.now() })
          }}
        />
      )}
    </div>
  )
}
