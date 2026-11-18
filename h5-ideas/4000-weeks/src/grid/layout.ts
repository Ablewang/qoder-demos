import { firstWeekOfIsoYear, isoYearOfWeek, lifeRowStarts, weekIdOf, weeksInIsoYear, type DateStr } from '../lib/date'
import { birthWeek, effectiveShowFuture, lastLivedWeek, rowCountFor, type Life } from '../lib/model'

/** Geometry is in grid units (1 unit = one cell pitch); the renderer converts to pixels. */
export type Strip = {
  lifeId: string
  /** weekId drawn in column 0 */
  startWeek: number
  length: number
  /** inclusive range of weeks that actually belong to this strip */
  from: number
  to: number
  /** weeks after this are drawn as hollow "future" cells */
  livedTo: number
  y: number
  label?: string
}

export type Header = { y: number; text: string }
export type Band = { y0: number; y1: number; col0: number; col1: number }

export type GridLayout = {
  cols: number
  height: number
  strips: Strip[]
  headers: Header[]
  bands: Band[]
}

export const COLS = 53
const DECADE_GAP = 0.6

export function personalLayout(life: Life, today: DateStr): GridLayout {
  const currentWeek = weekIdOf(today)
  const rowCount = rowCountFor(life, today)
  const starts = lifeRowStarts(life.birthDate, rowCount)
  const lived = lastLivedWeek(life, currentWeek)
  const to = effectiveShowFuture(life) ? starts[rowCount] - 1 : lived
  const strips: Strip[] = []
  let y = 0
  for (let n = 0; n < rowCount; n++) {
    const start = starts[n]
    if (start > to) break
    if (n > 0 && n % 10 === 0) y += DECADE_GAP
    const length = starts[n + 1] - start
    strips.push({
      lifeId: life.id,
      startWeek: start,
      length,
      from: start,
      to: Math.min(start + length - 1, to),
      livedTo: lived,
      y,
      label: n % 5 === 0 ? String(n) : undefined,
    })
    y += 1
  }
  return { cols: COLS, height: y, strips, headers: [], bands: [] }
}

export type TogetherRange = { from: number; to: number } | null

/** Weeks in which every selected life was present (a partner counts from the week you met). */
export function togetherRange(lives: Life[], currentWeek: number): TogetherRange {
  if (lives.length < 2) return null
  let from = -Infinity
  let to = Infinity
  for (const l of lives) {
    let start = birthWeek(l)
    if (l.relation === 'partner' && l.metDate) start = Math.max(start, weekIdOf(l.metDate))
    from = Math.max(from, start)
    to = Math.min(to, lastLivedWeek(l, currentWeek))
  }
  return from <= to ? { from, to } : null
}

export const HEADER_H = 2.4
const YEAR_GAP = 0.8

/**
 * Calendar alignment: one block per ISO week-year, one strip per person, and the
 * column is always weekId - firstWeekOfIsoYear(year). The same week therefore sits
 * in the same column for everyone, regardless of birthdays.
 */
export function compareLayout(lives: Life[], today: DateStr): GridLayout {
  const currentWeek = weekIdOf(today)
  const strips: Strip[] = []
  const headers: Header[] = []
  const bands: Band[] = []
  if (lives.length === 0) return { cols: COLS, height: 0, strips, headers, bands }
  const together = togetherRange(lives, currentWeek)
  const firstYear = Math.min(...lives.map((l) => isoYearOfWeek(birthWeek(l))))
  const lastYear = isoYearOfWeek(currentWeek)
  let y = 0
  for (let year = firstYear; year <= lastYear; year++) {
    const yearStart = firstWeekOfIsoYear(year)
    const length = weeksInIsoYear(year)
    const yearEnd = yearStart + length - 1
    const present = lives.filter((l) => birthWeek(l) <= yearEnd && lastLivedWeek(l, currentWeek) >= yearStart)
    if (present.length === 0) continue
    headers.push({ y, text: String(year) })
    y += HEADER_H
    const y0 = y
    for (const l of present) {
      strips.push({
        lifeId: l.id,
        startWeek: yearStart,
        length,
        from: Math.max(yearStart, birthWeek(l)),
        to: Math.min(yearEnd, lastLivedWeek(l, currentWeek)),
        livedTo: lastLivedWeek(l, currentWeek),
        y,
        label: l.name,
      })
      y += 1
    }
    if (together && present.length === lives.length && together.from <= yearEnd && together.to >= yearStart) {
      bands.push({
        y0,
        y1: y,
        col0: Math.max(together.from, yearStart) - yearStart,
        col1: Math.min(together.to, yearEnd) - yearStart,
      })
    }
    y += YEAR_GAP
  }
  return { cols: COLS, height: y, strips, headers, bands }
}

export type Hit = { strip: Strip; weekId: number }

/** `reach` (grid units) lets a near-miss between rows snap to the closest row. */
export function hitTest(layout: GridLayout, gx: number, gy: number, reach = 0): Hit | null {
  const col = Math.floor(gx)
  if (col < 0 || col >= layout.cols) return null
  let best: Strip | null = null
  let bestDist = Infinity
  for (const s of layout.strips) {
    if (gy >= s.y && gy < s.y + 1) {
      best = s
      bestDist = 0
      break
    }
    const dist = gy < s.y ? s.y - gy : gy - (s.y + 1)
    if (dist < bestDist) {
      best = s
      bestDist = dist
    }
  }
  if (!best || bestDist > reach) return null
  const weekId = best.startWeek + Math.min(col, best.length - 1)
  if (weekId < best.from || weekId > best.to) return null
  return { strip: best, weekId }
}

export function locateWeek(layout: GridLayout, weekId: number, lifeId?: string): Strip | null {
  return (
    layout.strips.find(
      (s) => (!lifeId || s.lifeId === lifeId) && weekId >= s.from && weekId <= s.to,
    ) ?? null
  )
}
