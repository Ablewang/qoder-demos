import { describe, expect, it } from 'vitest'
import { estimateCompanion } from './companion'

const base = { meetPerYear: 2, daysPerMeet: 5, toAge: 90, livesTogether: false }

describe('companion estimate', () => {
  it('multiplies remaining assumed years by meetings per year', () => {
    const r = estimateCompanion('1959-11-17', '2026-11-17', base)
    expect(r).toEqual({ kind: 'estimate', meets: 46, days: 230, years: 23 })
  })

  it('returns no number once age reaches the assumption', () => {
    expect(estimateCompanion('1930-01-01', '2026-11-17', base).kind).toBe('beyond')
    expect(estimateCompanion('1960-01-01', '2026-11-17', { ...base, meetPerYear: 0 }).kind).toBe('beyond')
  })

  it('does not count when living together', () => {
    expect(estimateCompanion('1960-01-01', '2026-11-17', { ...base, livesTogether: true }).kind).toBe('together')
  })
})
