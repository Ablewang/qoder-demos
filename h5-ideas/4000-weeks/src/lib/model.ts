import { ageOn, anniversary, weekIdOf, type DateStr } from './date'

export type Relation = 'self' | 'child' | 'partner' | 'parent' | 'pet' | 'other'

export const RELATIONS: Relation[] = ['self', 'child', 'partner', 'parent', 'pet', 'other']

export const RELATION_LABEL: Record<Relation, string> = {
  self: '我',
  child: '孩子',
  partner: '另一半',
  parent: '父母',
  pet: '宠物',
  other: '其他',
}

export type Companion = {
  meetPerYear: number
  daysPerMeet: number
  toAge: number
  livesTogether: boolean
}

export type Life = {
  id: string
  name: string
  relation: Relation
  birthDate: DateStr
  endDate?: DateStr
  drawToAge: number
  showFuture: boolean
  color: ThemeKey
  metDate?: DateStr
  companionOn?: boolean
  companion?: Companion
  order: number
  createdAt: number
  updatedAt: number
}

export type WeekEntry = {
  lifeId: string
  week: DateStr
  text?: string
  color?: MoodKey
  emoji?: string
  milestone?: string
  met?: boolean
  updatedAt: number
}

export const THEMES = {
  terracotta: { name: '赤陶', hex: '#C46A4A' },
  rose: { name: '玫瑰', hex: '#C97B84' },
  sunflower: { name: '向日葵', hex: '#D9A441' },
  sage: { name: '鼠尾草', hex: '#7E9C82' },
  mist: { name: '雾蓝', hex: '#6F8FAF' },
  plum: { name: '梅', hex: '#8E6C8A' },
  lake: { name: '湖绿', hex: '#4F9A94' },
  slate: { name: '石板', hex: '#6B7280' },
} as const
export type ThemeKey = keyof typeof THEMES
export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[]

export const MOODS = {
  sun: { name: '晴', hex: '#E0A93B' },
  warm: { name: '暖', hex: '#D9774E' },
  love: { name: '爱', hex: '#D46A7E' },
  calm: { name: '静', hex: '#6F9BB8' },
  grow: { name: '长', hex: '#6FA071' },
  deep: { name: '深', hex: '#6C5B8E' },
  rain: { name: '雨', hex: '#8C97A3' },
  ink: { name: '墨', hex: '#3E3A35' },
} as const
export type MoodKey = keyof typeof MOODS
export const MOOD_KEYS = Object.keys(MOODS) as MoodKey[]

export const EMOJIS = ['😊', '🥰', '😂', '😴', '😮‍💨', '🌧', '☀️', '🌱', '🎂', '🎉', '✈️', '🏠', '🍜', '📚', '💼', '🏃', '🚶', '👶', '❤️', '🤒', '🐾', '🎵', '📷', '⭐']

export const MILESTONE_HINTS: Record<Relation, string[]> = {
  self: ['入学', '毕业', '第一份工作', '搬家', '结婚', '旅行'],
  child: ['第一次笑', '会翻身', '会坐', '会走路', '叫了爸爸', '叫了妈妈', '上幼儿园'],
  partner: ['第一次约会', '在一起', '订婚', '结婚', '一起搬家'],
  parent: ['回家', '一起旅行', '生日', '退休'],
  pet: ['到家', '第一次出门', '生日'],
  other: ['相识', '重逢'],
}

export const DEFAULT_THEME: Record<Relation, ThemeKey> = {
  self: 'terracotta',
  partner: 'rose',
  child: 'sunflower',
  parent: 'sage',
  pet: 'lake',
  other: 'mist',
}

export const DEFAULT_DRAW_TO_AGE: Record<Relation, number> = {
  self: 90,
  partner: 90,
  child: 90,
  parent: 90,
  pet: 15,
  other: 90,
}

export const MAX_TEXT = 500

export function canShowFuture(life: Pick<Life, 'relation' | 'endDate'>): boolean {
  return life.relation !== 'child' && !life.endDate
}

export function effectiveShowFuture(life: Life): boolean {
  return canShowFuture(life) && life.showFuture
}

export function themeHex(key: string | undefined): string {
  return (key && key in THEMES ? THEMES[key as ThemeKey] : THEMES.slate).hex
}

export function moodHex(key: string | undefined): string | undefined {
  return key && key in MOODS ? MOODS[key as MoodKey].hex : undefined
}

export function isEntryEmpty(e: Partial<WeekEntry>): boolean {
  return !e.text?.trim() && !e.color && !e.emoji && !e.milestone?.trim() && !e.met
}

export function birthWeek(life: Life): number {
  return weekIdOf(life.birthDate)
}

/** Last week that belongs to this life on any view (end week, or today for the living). */
export function lastLivedWeek(life: Life, currentWeek: number): number {
  return life.endDate ? Math.min(weekIdOf(life.endDate), currentWeek) : currentWeek
}

export function rowCountFor(life: Life, today: DateStr): number {
  const lastDate = life.endDate ?? today
  const lived = lastLivedWeek(life, weekIdOf(today))
  let rowCount = Math.max(life.drawToAge, ageOn(life.birthDate, lastDate) + 1)
  // Birthday-aligned rows begin on Monday, possibly before the birthday itself.
  while (weekIdOf(anniversary(life.birthDate, rowCount)) <= lived) rowCount += 1
  return rowCount
}

export type DerivedMark = { weekId: number; label: string }

/** Milestones computed from other lives, never stored, so they follow date edits. */
export function derivedMarks(life: Life, all: Life[]): DerivedMark[] {
  const marks: DerivedMark[] = [{ weekId: birthWeek(life), label: life.relation === 'pet' ? '来到世上' : '出生' }]
  if (life.relation === 'partner' && life.metDate) marks.push({ weekId: weekIdOf(life.metDate), label: '相识' })
  if (life.endDate) marks.push({ weekId: weekIdOf(life.endDate), label: '离开' })
  const self = all.find((l) => l.relation === 'self')
  if (life.relation === 'self') {
    for (const other of all) {
      if (other.id === life.id) continue
      if (other.relation === 'child') marks.push({ weekId: birthWeek(other), label: `${other.name}出生` })
      if (other.relation === 'partner' && other.metDate) marks.push({ weekId: weekIdOf(other.metDate), label: `认识${other.name}` })
      if (other.relation === 'pet') marks.push({ weekId: birthWeek(other), label: `${other.name}出生` })
    }
  } else if (self && life.relation === 'parent') {
    marks.push({ weekId: birthWeek(self), label: '你出生了' })
  }
  return marks
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
