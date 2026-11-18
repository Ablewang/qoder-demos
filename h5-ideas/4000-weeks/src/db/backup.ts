import { checkPastDate, isMonday, isValidDate, toDay, type DateStr } from '../lib/date'
import {
  DEFAULT_DRAW_TO_AGE,
  DEFAULT_THEME,
  MAX_TEXT,
  MOODS,
  RELATIONS,
  RELATION_LABEL,
  THEMES,
  isEntryEmpty,
  type Companion,
  type Life,
  type MoodKey,
  type Relation,
  type ThemeKey,
  type WeekEntry,
} from '../lib/model'

export const APP_ID = 'one-week-one-cell'
export const SCHEMA_VERSION = 1
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024

export type Dataset = { lives: Life[]; entries: WeekEntry[] }

export type BackupFile = Dataset & {
  app: typeof APP_ID
  schemaVersion: number
  exportedAt: string
}

export function buildBackup(data: Dataset, now = new Date()): BackupFile {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    lives: [...data.lives].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id)),
    entries: [...data.entries].sort((a, b) => a.lifeId.localeCompare(b.lifeId) || a.week.localeCompare(b.week)),
  }
}

export function backupFileName(today: DateStr): string {
  return `一周一格-备份-${today}.json`
}

export type ValidateResult =
  | { ok: true; data: Dataset; warnings: string[] }
  | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = num(v)
  return n === undefined ? dflt : Math.min(max, Math.max(min, Math.round(n)))
}

function validateLife(raw: unknown, today: DateStr, warn: (s: string) => void): Life | null {
  if (!isObj(raw)) return null
  const id = str(raw.id)?.trim()
  if (!id || id.length > 100) {
    warn('跳过了 1 个缺少编号的人物')
    return null
  }
  const name = (str(raw.name) ?? '').trim().slice(0, 40) || '未命名'
  const birthDate = str(raw.birthDate) ?? ''
  const birthCheck = checkPastDate(birthDate, today, '生日')
  if (!birthCheck.ok) {
    warn(`跳过了「${name}」：${birthCheck.reason}`)
    return null
  }
  let relation = str(raw.relation) as Relation
  if (!RELATIONS.includes(relation)) {
    warn(`「${name}」的关系无法识别，已按「其他」导入`)
    relation = 'other'
  }
  const optionalDate = (v: unknown, label: string): DateStr | undefined => {
    const s = str(v)
    if (!s) return undefined
    if (!isValidDate(s) || !checkPastDate(s, today).ok || toDay(s) < toDay(birthDate)) {
      warn(`「${name}」的${label}无效，已忽略`)
      return undefined
    }
    return s
  }
  const now = Date.now()
  const life: Life = {
    id,
    name,
    relation,
    birthDate,
    drawToAge: clampInt(raw.drawToAge, 1, 130, DEFAULT_DRAW_TO_AGE[relation]),
    showFuture: relation === 'child' ? false : raw.showFuture === true,
    color: (str(raw.color) && str(raw.color)! in THEMES ? raw.color : DEFAULT_THEME[relation]) as ThemeKey,
    order: num(raw.order) ?? 0,
    createdAt: num(raw.createdAt) ?? now,
    updatedAt: num(raw.updatedAt) ?? now,
  }
  const endDate = optionalDate(raw.endDate, '离开的日子')
  if (endDate) {
    life.endDate = endDate
    life.showFuture = false
  }
  if (relation === 'partner') {
    const metDate = optionalDate(raw.metDate, '相识日')
    if (metDate) life.metDate = metDate
  }
  if (relation === 'parent' && isObj(raw.companion)) {
    const c = raw.companion
    const companion: Companion = {
      meetPerYear: clampInt(c.meetPerYear, 0, 365, 2),
      daysPerMeet: clampInt(c.daysPerMeet, 0, 365, 3),
      toAge: clampInt(c.toAge, 1, 130, 90),
      livesTogether: c.livesTogether === true,
    }
    life.companion = companion
    life.companionOn = raw.companionOn === true
  }
  return life
}

function validateEntry(raw: unknown, warn: (s: string) => void): WeekEntry | null {
  if (!isObj(raw)) return null
  const lifeId = str(raw.lifeId)
  const week = str(raw.week)
  if (!lifeId || !week || !isMonday(week)) {
    warn('跳过了 1 条周键无效的记录')
    return null
  }
  const e: WeekEntry = { lifeId, week, updatedAt: num(raw.updatedAt) ?? Date.now() }
  const text = str(raw.text)
  if (text) {
    if (text.length > MAX_TEXT) warn(`${week} 那周的一句话超过 ${MAX_TEXT} 字，已截断`)
    e.text = text.slice(0, MAX_TEXT)
  }
  const color = str(raw.color)
  if (color && color in MOODS) e.color = color as MoodKey
  const emoji = str(raw.emoji)
  if (emoji && emoji.length <= 16) e.emoji = emoji
  const milestone = str(raw.milestone)?.trim()
  if (milestone) e.milestone = milestone.slice(0, 40)
  if (raw.met === true) e.met = true
  return isEntryEmpty(e) ? null : e
}

export function validateBackup(raw: unknown, today: DateStr): ValidateResult {
  if (!isObj(raw)) return { ok: false, error: '这不是一个备份文件' }
  if (raw.app !== APP_ID) return { ok: false, error: '这不是「一周一格」的备份文件' }
  const version = num(raw.schemaVersion)
  if (version === undefined) return { ok: false, error: '备份缺少版本号' }
  if (version > SCHEMA_VERSION) return { ok: false, error: '这个备份来自更新的版本，请先更新应用' }
  if (!Array.isArray(raw.lives) || !Array.isArray(raw.entries)) return { ok: false, error: '备份内容不完整' }

  const warnings: string[] = []
  const warn = (s: string) => warnings.push(s)
  const lives: Life[] = []
  const ids = new Set<string>()
  for (const r of raw.lives) {
    const life = validateLife(r, today, warn)
    if (!life) continue
    if (ids.has(life.id)) {
      warn(`备份里有重复的人物「${life.name}」，只保留第一个`)
      continue
    }
    if (life.relation === 'self' && lives.some((l) => l.relation === 'self')) {
      warn(`备份里有多个「我」，「${life.name}」已按「其他」导入`)
      life.relation = 'other'
    }
    ids.add(life.id)
    lives.push(life)
  }
  const entryMap = new Map<string, WeekEntry>()
  let orphans = 0
  let dupes = 0
  for (const r of raw.entries) {
    const e = validateEntry(r, warn)
    if (!e) continue
    if (!ids.has(e.lifeId)) {
      orphans++
      continue
    }
    const key = `${e.lifeId}|${e.week}`
    const prev = entryMap.get(key)
    if (prev) {
      dupes++
      if (prev.updatedAt > e.updatedAt) continue
    }
    entryMap.set(key, e)
  }
  if (orphans) warn(`跳过了 ${orphans} 条找不到所属人物的记录`)
  if (dupes) warn(`备份里有 ${dupes} 条重复的周记录，已保留较新的一条`)
  return { ok: true, data: { lives, entries: [...entryMap.values()] }, warnings }
}

export function datasetSignature(data: Dataset): string {
  return stable(buildBackup(data, new Date(0)))
}

export type Conflict<T> = { local: T; incoming: T }

export type ImportPlan = {
  lives: { added: Life[]; same: Life[]; conflicts: Conflict<Life>[] }
  entries: { added: WeekEntry[]; same: WeekEntry[]; conflicts: Conflict<WeekEntry>[] }
  /** incoming life id -> relation actually used (self collisions become "other") */
  relationFixes: Map<string, Relation>
  warnings: string[]
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (isObj(v)) {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}

function lifeContent(l: Life) {
  const { updatedAt: _u, order: _o, createdAt: _c, ...rest } = l
  return stable(rest)
}

function entryContent(e: WeekEntry) {
  return JSON.stringify([e.text ?? '', e.color ?? '', e.emoji ?? '', e.milestone ?? '', !!e.met])
}

export function analyzeImport(local: Dataset, incoming: Dataset): ImportPlan {
  const plan: ImportPlan = {
    lives: { added: [], same: [], conflicts: [] },
    entries: { added: [], same: [], conflicts: [] },
    relationFixes: new Map(),
    warnings: [],
  }
  const localLives = new Map(local.lives.map((l) => [l.id, l]))
  const localSelf = local.lives.find((l) => l.relation === 'self')
  for (const raw of incoming.lives) {
    let inc = raw
    if (inc.relation === 'self' && localSelf && localSelf.id !== inc.id) {
      inc = { ...inc, relation: 'other' }
      plan.relationFixes.set(inc.id, 'other')
      plan.warnings.push(`本机已经有「我」，备份里的「${raw.name}」将按「${RELATION_LABEL.other}」导入`)
    }
    const loc = localLives.get(inc.id)
    if (!loc) {
      const twin = local.lives.find((l) => l.name === inc.name && l.birthDate === inc.birthDate)
      if (twin) plan.warnings.push(`备份里的「${inc.name}」和本机的同名同生日人物不是同一份档案，导入后会出现两个「${inc.name}」`)
      plan.lives.added.push(inc)
    } else if (lifeContent(loc) === lifeContent(inc)) {
      plan.lives.same.push(inc)
    } else {
      plan.lives.conflicts.push({ local: loc, incoming: inc })
    }
  }
  const localEntries = new Map(local.entries.map((e) => [`${e.lifeId}|${e.week}`, e]))
  for (const inc of incoming.entries) {
    const loc = localEntries.get(`${inc.lifeId}|${inc.week}`)
    if (!loc) plan.entries.added.push(inc)
    else if (entryContent(loc) === entryContent(inc)) plan.entries.same.push(inc)
    else plan.entries.conflicts.push({ local: loc, incoming: inc })
  }
  return plan
}

/** Merge keeps every local record unless the user explicitly chose to overwrite conflicts. */
export function mergeDatasets(local: Dataset, plan: ImportPlan, overwriteConflicts: boolean): Dataset {
  const lives = new Map(local.lives.map((l) => [l.id, l]))
  let order = Math.max(0, ...local.lives.map((l) => l.order)) + 1
  for (const l of plan.lives.added) {
    if (!lives.has(l.id)) lives.set(l.id, { ...l, order: order++ })
  }
  if (overwriteConflicts) {
    for (const c of plan.lives.conflicts) lives.set(c.local.id, { ...c.incoming, order: c.local.order })
  }
  const entries = new Map(local.entries.map((e) => [`${e.lifeId}|${e.week}`, e]))
  for (const e of plan.entries.added) {
    const key = `${e.lifeId}|${e.week}`
    if (lives.has(e.lifeId) && !entries.has(key)) entries.set(key, e)
  }
  if (overwriteConflicts) {
    for (const c of plan.entries.conflicts) entries.set(`${c.incoming.lifeId}|${c.incoming.week}`, c.incoming)
  }
  const finalLives = [...lives.values()]
  const self = finalLives.filter((l) => l.relation === 'self')
  if (self.length > 1) {
    for (const l of self.slice(1)) lives.set(l.id, { ...l, relation: 'other' })
  }
  return { lives: [...lives.values()], entries: [...entries.values()] }
}
