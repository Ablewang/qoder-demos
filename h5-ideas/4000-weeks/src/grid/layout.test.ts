import { describe, expect, it } from 'vitest'
import { ageOn, anniversary, lifeRowStarts, weekIdOf } from '../lib/date'
import { lastLivedWeek, rowCountFor, type Life } from '../lib/model'
import { compareLayout, hitTest, locateWeek, personalLayout, togetherRange, type GridLayout } from './layout'

const today = '2026-11-17'
const life = (p: Partial<Life> & Pick<Life, 'id' | 'birthDate' | 'relation'>): Life => ({
  name: p.id,
  drawToAge: 90,
  showFuture: false,
  color: 'slate',
  order: 0,
  createdAt: 0,
  updatedAt: 0,
  ...p,
})

function expectContinuousRows(layout: GridLayout): void {
  expect(new Set(layout.strips.map((s) => s.length))).toEqual(new Set([52, 53]))
  for (let n = 0; n < layout.strips.length; n++) {
    const strip = layout.strips[n]
    expect(strip.from).toBe(strip.startWeek)
    expect(strip.to).toBeGreaterThanOrEqual(strip.from)
    expect(strip.to).toBeLessThanOrEqual(strip.startWeek + strip.length - 1)
    if (n > 0) {
      const previous = layout.strips[n - 1]
      expect(previous.to).toBe(previous.startWeek + previous.length - 1)
      expect(strip.from).toBe(previous.to + 1)
    }
  }
}

describe('personal layout', () => {
  it('stops a child grid at the current week and never shows the future', () => {
    const kid = life({ id: 'kid', relation: 'child', birthDate: '2025-03-15', showFuture: true })
    const l = personalLayout(kid, today)
    const last = l.strips[l.strips.length - 1]
    expect(last.to).toBe(weekIdOf(today))
    expect(l.strips).toHaveLength(2)
  })

  it('draws the full lifespan for self when future is on', () => {
    const me = life({ id: 'me', relation: 'self', birthDate: '1991-06-01', showFuture: true })
    const l = personalLayout(me, today)
    expect(l.strips).toHaveLength(90)
    expect(l.strips[35].label).toBe('35')
  })

  it.each([false, true])('includes 2026-11-17 for a 1930-11-20 birth with drawToAge 90 and showFuture %s', (showFuture) => {
    const gran = life({ id: 'g', relation: 'parent', birthDate: '1930-11-20', drawToAge: 90, showFuture })
    const l = personalLayout(gran, today)
    expect(ageOn(gran.birthDate, today)).toBe(95)
    expect(rowCountFor(gran, today)).toBe(97)
    expect(l.strips).toHaveLength(97)
    expect(locateWeek(l, weekIdOf(today))).toBe(l.strips[96])
    expectContinuousRows(l)
    const last = l.strips[96]
    expect(last.to).toBe(showFuture ? weekIdOf('2027-11-20') - 1 : weekIdOf(today))
    expect(locateWeek(l, last.to + 1)).toBeNull()
  })

  it('ends at the end date for someone who has passed away', () => {
    const pet = life({ id: 'p', relation: 'pet', birthDate: '2010-04-01', endDate: '2022-08-08', drawToAge: 15, showFuture: true })
    const l = personalLayout(pet, today)
    expect(l.strips[l.strips.length - 1].to).toBe(weekIdOf('2022-08-08'))
  })
})

describe('birthday-week row coverage', () => {
  it.each([
    { birthDate: '1930-11-20', on: '2026-11-15', age: 95, rows: 96 },
    { birthDate: '1930-11-20', on: '2026-11-16', age: 95, rows: 97 },
    { birthDate: '1930-11-20', on: '2026-11-19', age: 95, rows: 97 },
    { birthDate: '1930-11-20', on: '2026-11-20', age: 96, rows: 97 },
    { birthDate: '1930-11-20', on: '2026-11-21', age: 96, rows: 97 },
    { birthDate: '1930-11-20', on: '2026-11-23', age: 96, rows: 97 },
    // The 2026 birthday is Sunday: the new row starts six days earlier.
    { birthDate: '1930-11-22', on: '2026-11-15', age: 95, rows: 96 },
    { birthDate: '1930-11-22', on: '2026-11-16', age: 95, rows: 97 },
    { birthDate: '1930-11-22', on: '2026-11-21', age: 95, rows: 97 },
    { birthDate: '1930-11-22', on: '2026-11-22', age: 96, rows: 97 },
    { birthDate: '1930-11-22', on: '2026-11-23', age: 96, rows: 97 },
    // The 2026 birthday is Monday: age and row change on the same day.
    { birthDate: '1930-11-16', on: '2026-11-15', age: 95, rows: 96 },
    { birthDate: '1930-11-16', on: '2026-11-16', age: 96, rows: 97 },
    { birthDate: '1930-11-16', on: '2026-11-17', age: 96, rows: 97 },
    // The 2026 birthday week starts in the previous calendar year.
    { birthDate: '1930-01-01', on: '2025-12-28', age: 95, rows: 96 },
    { birthDate: '1930-01-01', on: '2025-12-29', age: 95, rows: 97 },
    { birthDate: '1930-01-01', on: '2025-12-31', age: 95, rows: 97 },
    { birthDate: '1930-01-01', on: '2026-01-01', age: 96, rows: 97 },
    { birthDate: '1930-01-01', on: '2026-01-02', age: 96, rows: 97 },
    // Feb 29 continues to use Feb 28 in common years, not March 1.
    { birthDate: '1928-02-29', on: '2026-02-22', age: 97, rows: 98 },
    { birthDate: '1928-02-29', on: '2026-02-23', age: 97, rows: 99 },
    { birthDate: '1928-02-29', on: '2026-02-27', age: 97, rows: 99 },
    { birthDate: '1928-02-29', on: '2026-02-28', age: 98, rows: 99 },
    { birthDate: '1928-02-29', on: '2026-03-01', age: 98, rows: 99 },
    { birthDate: '1928-02-29', on: '2027-02-22', age: 98, rows: 100 },
    { birthDate: '1928-02-29', on: '2027-02-28', age: 99, rows: 100 },
    { birthDate: '1928-02-29', on: '2027-03-01', age: 99, rows: 100 },
  ])('covers $birthDate on $on with $rows rows while real age stays $age', ({ birthDate, on, age, rows }) => {
    const person = life({ id: 'old', relation: 'self', birthDate, drawToAge: 90 })
    const count = rowCountFor(person, on)
    const lived = lastLivedWeek(person, weekIdOf(on))
    expect(ageOn(birthDate, on)).toBe(age)
    expect(count).toBe(rows)
    expect(weekIdOf(anniversary(birthDate, count))).toBeGreaterThan(lived)
    expect(weekIdOf(anniversary(birthDate, count - 1))).toBeLessThanOrEqual(lived)
    const l = personalLayout(person, on)
    expect(l.strips).toHaveLength(rows)
    expect(locateWeek(l, lived)).toBe(l.strips[rows - 1])
    expect(l.strips[rows - 1].to).toBe(lived)
    expect(locateWeek(l, lived + 1)).toBeNull()
    expectContinuousRows(l)
    const starts = lifeRowStarts(birthDate, count)
    for (let n = 0; n < l.strips.length; n++) {
      expect(l.strips[n].from).toBe(starts[n])
      expect(l.strips[n].length).toBe(starts[n + 1] - starts[n])
    }
  })

  it('keeps drawToAge as a lower bound without changing birthday anniversaries', () => {
    const person = life({ id: 'me', relation: 'self', birthDate: '1991-06-01', drawToAge: 90, showFuture: true })
    expect(rowCountFor(person, today)).toBe(90)
    const l = personalLayout(person, today)
    expect(l.strips).toHaveLength(90)
    expect(locateWeek(l, weekIdOf(today))).not.toBeNull()
    expect(l.strips[89].to).toBe(weekIdOf(anniversary(person.birthDate, 90)) - 1)
    expectContinuousRows(l)
    expect(anniversary('1928-02-29', 98)).toBe('2026-02-28')
    expect(anniversary('1928-02-29', 99)).toBe('2027-02-28')
    expect(weekIdOf('2027-03-01')).toBe(weekIdOf('2027-02-28') + 1)
  })

  it.each([
    { birthDate: '1930-11-20', endDate: '2026-11-15', on: '2026-12-01', rows: 96 },
    { birthDate: '1930-11-20', endDate: '2026-11-17', on: '2026-12-01', rows: 97 },
    { birthDate: '1930-11-20', endDate: '2026-11-20', on: '2026-12-01', rows: 97 },
    { birthDate: '1930-11-20', endDate: '2026-11-21', on: '2026-12-01', rows: 97 },
    { birthDate: '1930-11-20', endDate: '2020-11-17', on: today, rows: 91 },
    { birthDate: '1930-01-01', endDate: '2025-12-29', on: '2026-01-02', rows: 97 },
    { birthDate: '1928-02-29', endDate: '2027-02-22', on: '2027-03-01', rows: 100 },
  ])('uses endDate $endDate for $birthDate, not today $on', ({ birthDate, endDate, on, rows }) => {
    const person = life({ id: 'ended', relation: 'parent', birthDate, endDate, drawToAge: 90, showFuture: true })
    const count = rowCountFor(person, on)
    const lived = lastLivedWeek(person, weekIdOf(on))
    expect(count).toBe(rows)
    expect(rowCountFor(person, endDate)).toBe(count)
    expect(weekIdOf(anniversary(birthDate, count))).toBeGreaterThan(lived)
    expect(weekIdOf(anniversary(birthDate, count - 1))).toBeLessThanOrEqual(lived)
    const l = personalLayout(person, on)
    expect(l.strips).toHaveLength(rows)
    expect(locateWeek(l, lived)).toBe(l.strips[rows - 1])
    expect(l.strips[rows - 1].to).toBe(weekIdOf(endDate))
    expect(locateWeek(l, lived + 1)).toBeNull()
    // Dates after endDate can still share its final cell; later weeks cannot.
    expect(locateWeek(l, weekIdOf(on))).toBe(weekIdOf(on) === lived ? l.strips[rows - 1] : null)
    expectContinuousRows(l)
  })
})

describe('calendar alignment', () => {
  const me = life({ id: 'me', relation: 'self', birthDate: '1991-06-01' })
  const partner = life({ id: 'pa', relation: 'partner', birthDate: '1992-10-23', metDate: '2018-04-12' })
  const kid = life({ id: 'kid', relation: 'child', birthDate: '2025-03-15' })

  it('puts the same calendar week in the same column for every person', () => {
    const l = compareLayout([me, partner, kid], today)
    for (const date of ['2025-03-15', '2025-03-17', '2024-12-31', '2026-11-17', '2018-04-12']) {
      const w = weekIdOf(date)
      const strips = l.strips.filter((s) => w >= s.from && w <= s.to)
      expect(strips.length).toBeGreaterThanOrEqual(2)
      const cols = new Set(strips.map((s) => w - s.startWeek))
      expect(cols.size).toBe(1)
      for (const s of strips) {
        const hit = hitTest(l, w - s.startWeek + 0.5, s.y + 0.5)
        expect(hit?.weekId).toBe(w)
        expect(hit?.strip.lifeId).toBe(s.lifeId)
      }
    }
  })

  it('is not a side-by-side of birthday-aligned grids', () => {
    const l = compareLayout([me, partner], today)
    const w = weekIdOf('2020-07-01')
    const a = l.strips.find((s) => s.lifeId === 'me' && w >= s.from && w <= s.to)!
    const b = l.strips.find((s) => s.lifeId === 'pa' && w >= s.from && w <= s.to)!
    expect(a.startWeek).toBe(b.startWeek)
    expect(Math.abs(a.y - b.y)).toBe(1)
  })

  it('computes together weeks from the week a partner was met', () => {
    expect(togetherRange([me, partner], weekIdOf(today))).toEqual({ from: weekIdOf('2018-04-12'), to: weekIdOf(today) })
    expect(togetherRange([me, partner, kid], weekIdOf(today))?.from).toBe(weekIdOf('2025-03-15'))
    const l = compareLayout([me, partner], today)
    expect(l.bands.length).toBe(2026 - 2018 + 1)
  })

  it('selects the next person at an exact shared row boundary', () => {
    const l = compareLayout([me, partner], today)
    const w = weekIdOf('2020-07-01')
    const s = locateWeek(l, w, 'pa')!
    expect(hitTest(l, w - s.startWeek + 0.5, s.y)?.strip.lifeId).toBe('pa')
  })

  it('snaps only nearby vertical gaps and does not invent future weeks', () => {
    const l = compareLayout([me, partner], today)
    const w = weekIdOf('2020-07-01')
    const s = locateWeek(l, w, 'me')!
    const x = w - s.startWeek + 0.5
    expect(hitTest(l, x, s.y - 0.2)).toBeNull()
    expect(hitTest(l, x, s.y - 0.2, 0.3)?.weekId).toBe(w)
    expect(hitTest(l, x, s.y - 1, 0.3)).toBeNull()
    expect(hitTest(l, -0.1, s.y + 0.5, 2)).toBeNull()
    expect(hitTest(l, 53, s.y + 0.5, 2)).toBeNull()
    const last = locateWeek(l, weekIdOf(today), 'me')!
    expect(hitTest(l, last.to - last.startWeek + 1.5, last.y + 0.5, 2)).toBeNull()
  })

  it('does not draw beyond the current week', () => {
    const l = compareLayout([me, kid], today)
    expect(Math.max(...l.strips.map((s) => s.to))).toBe(weekIdOf(today))
  })
})
