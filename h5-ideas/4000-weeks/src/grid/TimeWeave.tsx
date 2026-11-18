import { personalLayout } from './layout'
import { firstWeekOfIsoYear, isoYearOfWeek, weekKey, weeksInIsoYear } from '../lib/date'
import { isEntryEmpty, moodHex, themeHex, type Life, type WeekEntry } from '../lib/model'

export function TimeWeave(props: { life: Life; today: string; currentWeek: number; entries?: Map<number, WeekEntry> }) {
  const layout = personalLayout({ ...props.life, showFuture: false }, props.today)
  return (
    <div class="mini-weave" role="img" aria-label={`${props.life.name}已经走过的时间，每行一岁，每格一周`}>
      {layout.strips.map((row) => (
        <div class="mini-row" key={row.startWeek} data-length={row.length}>
          {Array.from({ length: row.to - row.from + 1 }, (_, col) => {
            const wk = row.from + col
            const entry = props.entries?.get(wk)
            const written = !!entry && !isEntryEmpty(entry)
            return <span key={wk} data-week={weekKey(wk)} data-state={written ? 'written' : 'unwritten'} class={`thread-cell${written ? ' written' : ''}${wk === props.currentWeek ? ' current' : ''}${entry?.milestone ? ' milestone' : ''}`} style={{ '--thread-ink': written ? moodHex(entry.color) ?? themeHex(props.life.color) : themeHex(props.life.color) }} />
          })}
        </div>
      ))}
    </div>
  )
}

export function CalendarSample(props: { currentWeek: number }) {
  const year = isoYearOfWeek(props.currentWeek)
  const first = firstWeekOfIsoYear(year)
  const length = weeksInIsoYear(year)
  return (
    <div class="calendar-sample" role="img" aria-label={`${year}年真实日历，共${length}个自然周，红框是这一周；尚未建立人物，不含记录`}>
      <div class="sample-axis"><span>{year} / 日历周</span><span>{length} 周</span></div>
      <div class="sample-weeks">
        {Array.from({ length }, (_, i) => <span key={i} data-week={weekKey(first + i)} class={`sample-cell${first + i === props.currentWeek ? ' current' : first + i > props.currentWeek ? ' future' : ''}`} />)}
      </div>
      <div class="sample-caption">一格一周 · 红框是现在 · 这里还没有人物记录</div>
    </div>
  )
}
