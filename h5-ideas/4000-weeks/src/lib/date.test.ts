import { describe, expect, it } from 'vitest'
import {
  ageOn,
  anniversary,
  checkPastDate,
  firstWeekOfIsoYear,
  fromDay,
  isMonday,
  isoYearOfWeek,
  isValidDate,
  lifeRowStarts,
  toDay,
  todayStr,
  weekIdOf,
  weekKey,
  weekNumberSince,
  weeksInIsoYear,
} from './date'

describe('civil dates', () => {
  it('round-trips day numbers, including before 1970', () => {
    for (const s of ['1970-01-01', '1969-12-31', '1950-06-15', '1900-01-01', '2000-02-29', '2026-11-17', '2099-12-31']) {
      expect(fromDay(toDay(s))).toBe(s)
    }
    expect(toDay('1970-01-01')).toBe(0)
    expect(toDay('1969-12-31')).toBe(-1)
  })

  it('rejects impossible dates', () => {
    expect(isValidDate('2023-02-29')).toBe(false)
    expect(isValidDate('2024-02-29')).toBe(true)
    expect(isValidDate('1900-02-29')).toBe(false)
    expect(isValidDate('2000-02-29')).toBe(true)
    expect(isValidDate('2024-13-01')).toBe(false)
    expect(isValidDate('2024-4-1')).toBe(false)
  })

  it('reads today from local calendar fields', () => {
    expect(todayStr(new Date(2026, 10, 17, 23, 59))).toBe('2026-11-17')
    expect(todayStr(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01')
  })
})

describe('Monday-based weeks', () => {
  it('maps every day of a week to its Monday', () => {
    // 2026-11-16 is a Monday
    for (let i = 0; i < 7; i++) expect(weekKey(weekIdOf(fromDay(toDay('2026-11-16') + i)))).toBe('2026-11-16')
    expect(weekKey(weekIdOf('2026-11-15'))).toBe('2026-11-09')
  })

  it('works for negative day numbers (pre-1970)', () => {
    expect(weekKey(weekIdOf('1970-01-01'))).toBe('1969-12-29')
    expect(weekKey(weekIdOf('1955-03-20'))).toBe('1955-03-14') // Sunday
    expect(weekKey(weekIdOf('1955-03-14'))).toBe('1955-03-14') // Monday
    expect(isMonday('1955-03-14')).toBe(true)
    expect(isMonday('1955-03-15')).toBe(false)
  })

  it('handles the week that spans New Year', () => {
    const w = weekIdOf('2025-01-01')
    expect(weekKey(w)).toBe('2024-12-30')
    expect(weekIdOf('2024-12-31')).toBe(w)
    expect(weekIdOf('2025-01-05')).toBe(w)
    expect(isoYearOfWeek(w)).toBe(2025)
    expect(isoYearOfWeek(weekIdOf('2021-01-03'))).toBe(2020)
  })

  it('counts 52 or 53 ISO weeks per year', () => {
    expect(weeksInIsoYear(2020)).toBe(53)
    expect(weeksInIsoYear(2021)).toBe(52)
    expect(weeksInIsoYear(2026)).toBe(53)
    expect(weekKey(firstWeekOfIsoYear(2026))).toBe('2025-12-29')
    for (let y = 1900; y < 2100; y++) expect([52, 53]).toContain(weeksInIsoYear(y))
  })

  it('numbers weeks from the birth week, for Sunday and Monday births', () => {
    expect(weekNumberSince('2024-03-17', weekIdOf('2024-03-17'))).toBe(1) // Sunday
    expect(weekNumberSince('2024-03-17', weekIdOf('2024-03-18'))).toBe(2)
    expect(weekNumberSince('2024-03-18', weekIdOf('2024-03-24'))).toBe(1) // Monday
  })
})

describe('birthdays and rows', () => {
  it('moves Feb 29 to Feb 28 in common years', () => {
    expect(anniversary('2000-02-29', 1)).toBe('2001-02-28')
    expect(anniversary('2000-02-29', 4)).toBe('2004-02-29')
    expect(anniversary('2000-02-29', 100)).toBe('2100-02-28')
    expect(ageOn('2000-02-29', '2001-02-27')).toBe(0)
    expect(ageOn('2000-02-29', '2001-02-28')).toBe(1)
  })

  it('starts a new row exactly on the birthday week', () => {
    expect(ageOn('1990-05-20', '2026-05-19')).toBe(35)
    expect(ageOn('1990-05-20', '2026-05-20')).toBe(36)
    const starts = lifeRowStarts('1990-05-20', 40)
    expect(starts[36]).toBe(weekIdOf('2026-05-20'))
  })

  it('keeps every row at 52 or 53 weeks and contiguous', () => {
    const births = ['1950-01-01', '1955-03-20', '1969-12-31', '1988-12-31', '2000-02-29', '2004-02-29', '2023-01-02', '2024-12-29', '2026-11-17']
    for (const b of births) {
      const starts = lifeRowStarts(b, 100)
      expect(starts[0]).toBe(weekIdOf(b))
      let total = 0
      for (let n = 0; n < 100; n++) {
        const len = starts[n + 1] - starts[n]
        expect([52, 53]).toContain(len)
        total += len
      }
      expect(total).toBe(weekIdOf(anniversary(b, 100)) - weekIdOf(b))
    }
  })

  it('rejects future, too-old and malformed birth dates', () => {
    const today = '2026-11-17'
    expect(checkPastDate('2026-11-17', today).ok).toBe(true)
    expect(checkPastDate('2026-11-18', today).ok).toBe(false)
    expect(checkPastDate('1899-12-31', today).ok).toBe(false)
    expect(checkPastDate('2023-02-29', today).ok).toBe(false)
    expect(checkPastDate('', today).ok).toBe(false)
  })
})
