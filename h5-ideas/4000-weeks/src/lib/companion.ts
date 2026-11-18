import { exactAge, type DateStr } from './date'
import type { Companion } from './model'

export type CompanionResult =
  | { kind: 'together' }
  | { kind: 'beyond' }
  | { kind: 'estimate'; meets: number; days: number; years: number }

/**
 * Turns the user's own assumptions into a rough number. Not a prediction:
 * callers must always show the assumptions next to the result.
 */
export function estimateCompanion(birthDate: DateStr, today: DateStr, c: Companion): CompanionResult {
  if (c.livesTogether) return { kind: 'together' }
  const years = c.toAge - exactAge(birthDate, today)
  if (years <= 0 || c.meetPerYear <= 0) return { kind: 'beyond' }
  const meets = Math.floor(years * c.meetPerYear)
  if (meets < 1) return { kind: 'beyond' }
  return { kind: 'estimate', meets, days: Math.round(meets * Math.max(0, c.daysPerMeet)), years }
}

export const DEFAULT_COMPANION: Companion = { meetPerYear: 2, daysPerMeet: 3, toAge: 90, livesTogether: false }
