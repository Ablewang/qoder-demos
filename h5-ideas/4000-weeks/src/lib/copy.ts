// All user-facing wording about time lives here so it can be reviewed against PLAN.md §3.6/§7.1:
// cherish rather than count down; no percentages; no "remaining weeks"; nothing implies a known lifespan.
import { estimateCompanion } from './companion'
import { ageYearsMonths, firstWeekOfIsoYear, isoYearOfWeek, weekIdOf, weekNumberSince, type DateStr } from './date'
import { birthWeek, lastLivedWeek, type Life } from './model'

export function isoWeekLabel(weekId: number): string {
  const y = isoYearOfWeek(weekId)
  return `${y} 年第 ${weekId - firstWeekOfIsoYear(y) + 1} 周`
}

export function ageLabel(life: Life, today: DateStr): string {
  const { years, months } = ageYearsMonths(life.birthDate, life.endDate ?? today)
  if (years < 3) return years === 0 ? `${months} 个月` : `${years} 岁 ${months} 个月`
  return `${years} 岁`
}

export function overlapWeeks(a: Life, b: Life, currentWeek: number): number {
  let from = Math.max(birthWeek(a), birthWeek(b))
  for (const l of [a, b]) if (l.relation === 'partner' && l.metDate) from = Math.max(from, weekIdOf(l.metDate))
  const to = Math.min(lastLivedWeek(a, currentWeek), lastLivedWeek(b, currentWeek))
  return Math.max(0, to - from + 1)
}

const fmt = (n: number) => n.toLocaleString('zh-CN')

export function lifeSubtitle(life: Life, all: Life[], written: number, today: DateStr): string {
  const currentWeek = weekIdOf(today)
  const self = all.find((l) => l.relation === 'self' && l.id !== life.id)
  const nth = weekNumberSince(life.birthDate, currentWeek)
  if (life.endDate) {
    if (self) {
      const n = overlapWeeks(self, life, currentWeek)
      if (n > 0) return `一起走过 ${fmt(n)} 周`
    }
    return `走过 ${fmt(lastLivedWeek(life, currentWeek) - birthWeek(life) + 1)} 周 · 记下 ${fmt(written)} 周`
  }
  switch (life.relation) {
    case 'self':
      return `第 ${fmt(nth)} 周 · 已记下 ${fmt(written)} 周`
    case 'child':
      return `已陪伴 ${fmt(nth)} 周`
    case 'partner':
      return life.metDate ? `一起第 ${fmt(weekNumberSince(life.metDate, currentWeek))} 周` : `已记下 ${fmt(written)} 周`
    case 'parent': {
      if (life.companionOn && life.companion) {
        const r = estimateCompanion(life.birthDate, today, life.companion)
        if (r.kind === 'estimate') return `按你的假设，还能再见约 ${fmt(r.meets)} 次`
      }
      return self ? `一起走过 ${fmt(overlapWeeks(self, life, currentWeek))} 周` : `已记下 ${fmt(written)} 周`
    }
    default:
      return `第 ${fmt(nth)} 周 · 已记下 ${fmt(written)} 周`
  }
}

export { fmt }
