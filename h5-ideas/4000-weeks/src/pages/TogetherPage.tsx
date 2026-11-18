import { useMemo, useState } from 'preact/hooks'
import { GridCanvas, type Flash, type Selection } from '../grid/GridCanvas'
import { compareLayout, togetherRange } from '../grid/layout'
import { compareStyle, usePalette } from '../grid/styles'
import { formatWeekRange } from '../lib/date'
import { birthWeek, RELATION_LABEL, themeHex, type Life } from '../lib/model'
import { go } from '../router'
import { useAppState } from '../state/store'
import { EntryEditor, TabBar } from '../ui/ui'
import { WeekSheet } from './WeekSheet'

const KEY = 'one-week-one-cell:together'
const MAX = 4

function loadPicked(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch { return [] }
}

export function TogetherPage() {
  const st = useAppState()
  const { lives, today, currentWeek } = st
  const pal = usePalette()
  const [picked, setPicked] = useState<string[]>(loadPicked)
  const [sel, setSel] = useState<Selection>(null)
  const [editing, setEditing] = useState<{ life: Life; weekId: number } | null>(null)
  const [flash, setFlash] = useState<Flash>(null)
  const valid = picked.filter((id) => lives.some((l) => l.id === id))
  const ids = valid.length >= 2 ? valid : lives.slice(0, MAX).map((l) => l.id)
  const chosen = useMemo(() => lives.filter((l) => ids.includes(l.id)), [lives, ids.join('|')])
  const layout = useMemo(() => {
    const result = compareLayout(chosen, today)
    return { ...result, strips: result.strips.map(strip => ({ ...strip, label: String(chosen.findIndex(l => l.id === strip.lifeId) + 1).padStart(2, '0') })) }
  }, [chosen, today])
  const cellStyle = useMemo(() => compareStyle(chosen, st.entries, pal), [chosen, st.entries, pal])
  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAX ? [...ids, id] : ids
    setPicked(next)
    setSel(null)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { }
  }
  const range = togetherRange(chosen, currentWeek)
  const earliest = chosen.length ? Math.min(...chosen.map(birthWeek)) : currentWeek
  const selWeek = sel?.weekId ?? currentWeek
  return (
    <div class="page together-page">
      <header class="masthead"><span class="wordmark">一周一格</span><button type="button" class="link-btn" onClick={() => go('/')}>家人 ↗</button></header>
      <header class="home-head"><h1>同一周，我们。</h1><p class="sub">同一列是同一个周一，每人一行。</p></header>
      {lives.length < 2 ? <section class="empty-page"><p>两张时间页，就能在同一条日历轴上相遇。</p><button type="button" class="btn" onClick={() => go('/person/new')}>再添加一个人</button></section> : <>
        <div class="time-position"><span>{selWeek === currentWeek ? '当前周' : '所选周'}</span><span>{formatWeekRange(selWeek)}</span></div>
        <div class="weave-tools"><h2>日历对齐</h2><details class="people-picker"><summary>选择人物 · {chosen.length} 人</summary><div class="pick" role="group" aria-label="选择要对齐的人（2 到 4 人）">{lives.map(life => { const on = ids.includes(life.id); return <button type="button" key={life.id} class={`picker-person${on ? ' on' : ''}`} aria-pressed={on} disabled={(!on && ids.length >= MAX) || (on && ids.length <= 2)} onClick={() => toggle(life.id)}><span class="swatch sm" style={{ background: themeHex(life.color) }} />{life.name}<span class="relation">{RELATION_LABEL[life.relation]}</span><span>{on ? '已选' : '选入'}</span></button> })}</div></details></div>
        <GridCanvas layout={layout} gutter={34} initialZoom={3} calendarAxis cellStyle={cellStyle} bandColor={pal.band} currentWeek={currentWeek} accent={id => themeHex(chosen.find(l => l.id === id)?.color)} selected={sel ?? { lifeId: chosen[0].id, weekId: currentWeek }} onSelect={hit => setSel(hit ? { lifeId: hit.strip.lifeId, weekId: hit.weekId } : null)} onActivate={() => { const life = chosen.find(l => l.id === (sel?.lifeId ?? chosen[0].id)); if (life) setEditing({ life, weekId: selWeek }) }} focus={{ weekId: selWeek }} flash={flash} ariaLabel={`${chosen.map(l => l.name).join('、')}按日历对齐的格子，左侧编号对应下面的署名`} />
        <div class="comparison-key">{chosen.map((life, i) => <div key={life.id}><span class="folio">{String(i + 1).padStart(2, '0')}</span><span>{life.name}</span><span class="relation">{RELATION_LABEL[life.relation]}</span></div>)}</div>
        <p class="grid-caption">空心是未记，实色是有记录，外框是当前周。{range ? '暖色底带是共同在场的周；有相识日期时，另一半从相识那周开始。' : '这几张时间页没有共同在场的周。'} 每年仍保留真实 52 / 53 个自然周。</p>
        <WeekSheet weekId={selWeek} currentWeek={currentWeek} lives={chosen} all={lives} canPrev={selWeek > earliest} canNext={selWeek < currentWeek} onPrev={() => setSel({ lifeId: sel?.lifeId ?? chosen[0].id, weekId: selWeek - 1 })} onNext={() => setSel({ lifeId: sel?.lifeId ?? chosen[0].id, weekId: selWeek + 1 })} onClose={sel ? () => setSel(null) : undefined} onWrite={lifeId => { const life = chosen.find(l => l.id === lifeId); if (life) setEditing({ life, weekId: selWeek }) }} />
      </>}
      {editing && <EntryEditor key={`${editing.life.id}:${editing.weekId}`} life={editing.life} weekId={editing.weekId} onClose={() => setEditing(null)} onSaved={() => setFlash({ lifeId: editing.life.id, weekId: editing.weekId, at: performance.now() })} />}
      <TabBar active="together" />
    </div>
  )
}
