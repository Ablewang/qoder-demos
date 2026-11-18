// Civil-date arithmetic only: dates are 'YYYY-MM-DD' strings converted to integer day numbers
// via Date.UTC, so neither the device timezone nor DST can shift a week boundary.

const MS_PER_DAY = 86_400_000
export const MIN_YEAR = 1900

export type DateStr = string

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDate(s: string): { y: number; m: number; d: number } | null {
  const match = DATE_RE.exec(s)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return { y, m, d }
}

export function isValidDate(s: string): boolean {
  return parseDate(s) !== null
}

export function toDay(s: DateStr): number {
  const p = parseDate(s)
  if (!p) throw new Error(`Invalid date: ${s}`)
  return Math.round(Date.UTC(p.y, p.m - 1, p.d) / MS_PER_DAY)
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export function fromDay(day: number): DateStr {
  const t = new Date(day * MS_PER_DAY)
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export function todayStr(now: Date = new Date()): DateStr {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

// 1970-01-01 (day 0) is a Thursday, so Monday-based weeks start at day -3.
// Math.floor (not |0 or %) keeps pre-1970 negative day numbers correct.
export function weekIdOfDay(day: number): number {
  return Math.floor((day + 3) / 7)
}

export function weekIdOf(s: DateStr): number {
  return weekIdOfDay(toDay(s))
}

export function mondayDayOfWeek(weekId: number): number {
  return weekId * 7 - 3
}

export function weekKey(weekId: number): DateStr {
  return fromDay(mondayDayOfWeek(weekId))
}

export function isMonday(s: DateStr): boolean {
  if (!isValidDate(s)) return false
  const day = toDay(s)
  return mondayDayOfWeek(weekIdOfDay(day)) === day
}

/** Day 0 of a week is Monday; the ISO week-year is the calendar year of its Thursday. */
export function isoYearOfWeek(weekId: number): number {
  return new Date(weekId * 7 * MS_PER_DAY).getUTCFullYear()
}

export function firstWeekOfIsoYear(y: number): number {
  return Math.ceil(Math.round(Date.UTC(y, 0, 1) / MS_PER_DAY) / 7)
}

export function weeksInIsoYear(y: number): number {
  return firstWeekOfIsoYear(y + 1) - firstWeekOfIsoYear(y)
}

/** Feb 29 birthdays fall on Feb 28 in common years. */
export function anniversary(birth: DateStr, years: number): DateStr {
  const p = parseDate(birth)
  if (!p) throw new Error(`Invalid date: ${birth}`)
  const y = p.y + years
  const d = p.m === 2 && p.d === 29 && !isLeapYear(y) ? 28 : p.d
  return `${pad(y, 4)}-${pad(p.m)}-${pad(d)}`
}

export function ageOn(birth: DateStr, on: DateStr): number {
  const b = parseDate(birth)!
  const o = parseDate(on)!
  let age = o.y - b.y
  if (toDay(anniversary(birth, age)) > toDay(on)) age -= 1
  return age
}

export function ageYearsMonths(birth: DateStr, on: DateStr): { years: number; months: number } {
  const years = ageOn(birth, on)
  const b = parseDate(birth)!
  const o = parseDate(on)!
  let months = (o.y - b.y) * 12 + (o.m - b.m)
  if (o.d < b.d) months -= 1
  return { years, months: Math.max(0, months - years * 12) }
}

/** Fractional age in years, used only for rough companion estimates. */
export function exactAge(birth: DateStr, on: DateStr): number {
  const years = ageOn(birth, on)
  const start = toDay(anniversary(birth, years))
  const next = toDay(anniversary(birth, years + 1))
  return years + (toDay(on) - start) / (next - start)
}

/**
 * Row n of a personal grid runs from the week containing the n-th birthday up to
 * (not including) the week containing the (n+1)-th birthday. Consecutive birthdays
 * are 365 or 366 days apart, so every row holds 52 or 53 weeks.
 * Returns rowCount + 1 boundaries: row n = [starts[n], starts[n+1]).
 */
export function lifeRowStarts(birth: DateStr, rowCount: number): number[] {
  const starts: number[] = []
  for (let n = 0; n <= rowCount; n++) starts.push(weekIdOf(anniversary(birth, n)))
  return starts
}

export function weekNumberSince(start: DateStr, weekId: number): number {
  return weekId - weekIdOf(start) + 1
}

export type BirthCheck = { ok: true } | { ok: false; reason: string }

export function checkPastDate(s: string, today: DateStr, label = '日期'): BirthCheck {
  if (!s) return { ok: false, reason: `请填写${label}` }
  const p = parseDate(s)
  if (!p) return { ok: false, reason: `${label}不是一个有效的日期` }
  if (p.y < MIN_YEAR) return { ok: false, reason: `${label}不能早于 ${MIN_YEAR} 年` }
  if (toDay(s) > toDay(today)) return { ok: false, reason: `${label}不能晚于今天` }
  return { ok: true }
}

export function formatDate(s: DateStr, withYear = true): string {
  const p = parseDate(s)!
  return withYear ? `${p.y}年${p.m}月${p.d}日` : `${p.m}月${p.d}日`
}

export function formatWeekRange(weekId: number): string {
  const mon = fromDay(mondayDayOfWeek(weekId))
  const sun = fromDay(mondayDayOfWeek(weekId) + 6)
  const a = parseDate(mon)!
  const b = parseDate(sun)!
  if (a.y === b.y) return `${a.y}.${a.m}.${a.d} – ${b.m}.${b.d}`
  return `${a.y}.${a.m}.${a.d} – ${b.y}.${b.m}.${b.d}`
}
