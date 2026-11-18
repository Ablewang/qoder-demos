import { useEffect, useState } from 'preact/hooks'
import { analyzeImport, buildBackup, type Dataset } from '../db/backup'
import * as dbApi from '../db/db'
import { todayStr, weekIdOf, weekKey } from '../lib/date'
import { isEntryEmpty, type Life, type WeekEntry } from '../lib/model'

export type AppState = {
  ready: boolean
  error?: string
  writeWarning?: string
  lives: Life[]
  /** lifeId -> weekId -> entry */
  entries: Map<string, Map<number, WeekEntry>>
  today: string
  currentWeek: number
  lastBackupAt?: number
  lastWriteAt?: number
}

let db: dbApi.DB | null = null
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('one-week-one-cell') : null
const listeners = new Set<() => void>()
let state: AppState = { ready: false, lives: [], entries: new Map(), today: todayStr(), currentWeek: weekIdOf(todayStr()) }

function emit() {
  for (const l of listeners) l()
}

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  emit()
}

function indexEntries(list: WeekEntry[]) {
  const map = new Map<string, Map<number, WeekEntry>>()
  for (const e of list) {
    let m = map.get(e.lifeId)
    if (!m) map.set(e.lifeId, (m = new Map()))
    m.set(weekIdOf(e.week), e)
  }
  return map
}

function publishArchive(data: Dataset) {
  setState({
    ready: true,
    error: undefined,
    lives: data.lives.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
    entries: indexEntries(data.entries),
  })
}

async function reload() {
  const d = requireDb()
  const data = await dbApi.loadAll(d)
  publishArchive(data)
  const [lastBackupAt, lastWriteAt] = await Promise.allSettled([
    dbApi.getMeta<number>(d, 'lastBackupAt'),
    dbApi.getMeta<number>(d, 'lastWriteAt'),
  ])
  setState({
    ...(lastBackupAt.status === 'fulfilled' ? { lastBackupAt: lastBackupAt.value } : {}),
    ...(lastWriteAt.status === 'fulfilled' ? { lastWriteAt: lastWriteAt.value } : {}),
  })
  return lastBackupAt.status === 'rejected' || lastWriteAt.status === 'rejected'
}

export async function refreshStore() {
  try {
    const metadataFailed = await reload()
    setState({ writeWarning: metadataFailed ? '本机数据已重新读取，但保存时间等信息未能读取。' : undefined })
  } catch {
    setState({ writeWarning: '页面未能重新读取本机数据，请刷新页面核对。不要重复执行已完成的写入。' })
  }
}

function refreshToday() {
  const today = todayStr()
  if (today !== state.today) setState({ today, currentWeek: weekIdOf(today) })
}

export async function initStore() {
  try {
    db = await dbApi.openAppDB()
    if (await reload()) setState({ writeWarning: '本机数据已读取，但保存时间等信息未能读取。' })
  } catch (err) {
    setState({ ready: true, error: '无法打开本地存储。如果在无痕模式或某些内置浏览器中，请换用系统浏览器。' })
    console.error(err)
  }
  channel?.addEventListener('message', () => {
    void reload().then((metadataFailed) => {
      if (metadataFailed) setState({ writeWarning: '本机数据已读取，但保存时间等信息未能读取。' })
    }, () => setState({ writeWarning: '另一标签页通知了修改，但本页未能读取。请重新读取本机数据。' }))
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshToday()
  })
  setInterval(refreshToday, 60_000)
}

export function getState() {
  return state
}

export function useAppState(): AppState {
  const [, force] = useState(0)
  const rendered = state
  useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    // Effects run after paint; catch updates emitted before we subscribed.
    if (state !== rendered) l()
    return () => void listeners.delete(l)
  }, [])
  return state
}

function requireDb(): dbApi.DB {
  if (!db) throw new Error('数据库尚未就绪')
  return db
}

async function afterWrite() {
  const d = requireDb()
  const now = Date.now()
  const warnings: string[] = []
  try {
    await dbApi.setMeta(d, 'lastWriteAt', now)
    if (!(await dbApi.getMeta<boolean>(d, 'persistAsked'))) {
      await dbApi.setMeta(d, 'persistAsked', true)
      try {
        await navigator.storage?.persist?.()
      } catch {
        warnings.push('浏览器长期存储授权未完成，仍请定期导出。')
      }
    }
  } catch {
    warnings.push('保存时间或存储授权信息未更新。')
  }
  try {
    channel?.postMessage('changed')
  } catch {
    warnings.push('其他标签页未收到通知，请在那些页面重新读取。')
  }
  try {
    if (await reload()) warnings.push('存档已读取，但保存时间等信息未能读取。')
  } catch {
    try {
      if (await reload()) warnings.push('保存时间等信息未能读取。')
      warnings.push('页面重读曾失败，现已重新读取本机存档。')
    } catch {
      warnings.push('页面还未读到最新存档，请重新读取本机数据或刷新页面核对。')
    }
  }
  const warning = warnings.length ? `数据已写入本机，无需重复保存、导入或恢复。${warnings.join('')}` : undefined
  setState({ lastWriteAt: now, writeWarning: warning })
  return { warning }
}

export function saveFailureMessage(err: unknown) {
  return err instanceof dbApi.LifeRemovedError ? err.message : '没有保存成功，请再试一次。'
}

export async function createLife(life: Life) {
  await dbApi.createLife(requireDb(), { ...life, updatedAt: Date.now() })
  return afterWrite()
}

export async function saveLife(life: Life) {
  await dbApi.updateLife(requireDb(), { ...life, updatedAt: Date.now() })
  return afterWrite()
}

export async function removeLife(id: string): Promise<number> {
  const n = await dbApi.deleteLife(requireDb(), id)
  await afterWrite()
  return n
}

export function entryCount(lifeId: string): number {
  return state.entries.get(lifeId)?.size ?? 0
}

export function getEntry(lifeId: string, weekId: number): WeekEntry | undefined {
  return state.entries.get(lifeId)?.get(weekId)
}

export type EntryDraft = Pick<WeekEntry, 'text' | 'color' | 'emoji' | 'milestone' | 'met'>

export async function saveEntry(lifeId: string, weekId: number, draft: EntryDraft, guard?: { expected: WeekEntry | undefined }) {
  const d = requireDb()
  const week = weekKey(weekId)
  const clean: WeekEntry = { lifeId, week, updatedAt: Date.now() }
  if (draft.text?.trim()) clean.text = draft.text.trim()
  if (draft.color) clean.color = draft.color
  if (draft.emoji) clean.emoji = draft.emoji
  if (draft.milestone?.trim()) clean.milestone = draft.milestone.trim()
  if (draft.met) clean.met = true
  if (guard) {
    const result = await dbApi.compareAndSaveEntry(d, clean, guard.expected)
    if (result.conflict) return { ...result, warning: undefined }
  } else if (isEntryEmpty(clean)) await dbApi.deleteEntry(d, lifeId, week)
  else await dbApi.putEntry(d, clean)
  return { conflict: false as const, entry: isEntryEmpty(clean) ? undefined : clean, ...await afterWrite() }
}

export function currentDataset(): Dataset {
  const entries: WeekEntry[] = []
  for (const m of state.entries.values()) entries.push(...m.values())
  return { lives: state.lives, entries }
}

export async function markBackedUp(at = Date.now()) {
  await dbApi.setMeta(requireDb(), 'lastBackupAt', at)
  setState({ lastBackupAt: at })
}

export async function exportFile() {
  return buildBackup(await dbApi.loadAll(requireDb()))
}

export async function planImport(incoming: Dataset) {
  const local = await dbApi.loadAll(requireDb())
  return { local, plan: analyzeImport(local, incoming) }
}

export type ImportMode = dbApi.ImportMode

export async function applyImport(incoming: Dataset, reviewed: Dataset, mode: ImportMode) {
  const result = await dbApi.commitImport(requireDb(), incoming, reviewed, mode)
  if (result.status === 'applied') return { ...result, ...await afterWrite() }
  publishArchive(result.local)
  return result
}

export async function listSnapshots() {
  return dbApi.listSnapshots(requireDb())
}

export async function restoreSnapshot(snap: dbApi.Snapshot) {
  const d = requireDb()
  await dbApi.restoreArchive(d, { lives: snap.data.lives, entries: snap.data.entries })
  return afterWrite()
}
