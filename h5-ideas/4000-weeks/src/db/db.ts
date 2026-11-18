import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb'
import { isEntryEmpty, type Life, type WeekEntry } from '../lib/model'
import { analyzeImport, buildBackup, datasetSignature, mergeDatasets, type BackupFile, type Dataset, type ImportPlan } from './backup'

export const DB_NAME = 'one-week-one-cell'
const MAX_SNAPSHOTS = 3

export type Snapshot = { id: string; createdAt: number; reason: string; data: BackupFile }

interface Schema extends DBSchema {
  lives: { key: string; value: Life }
  entries: { key: [string, string]; value: WeekEntry; indexes: { byLife: string; byWeek: string } }
  meta: { key: string; value: { key: string; value: unknown } }
  snapshots: { key: string; value: Snapshot; indexes: { byCreated: number } }
}

export type DB = IDBPDatabase<Schema>

export function openAppDB(name = DB_NAME): Promise<DB> {
  return openDB<Schema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('lives', { keyPath: 'id' })
      const entries = db.createObjectStore('entries', { keyPath: ['lifeId', 'week'] })
      entries.createIndex('byLife', 'lifeId')
      entries.createIndex('byWeek', 'week')
      db.createObjectStore('meta', { keyPath: 'key' })
      const snaps = db.createObjectStore('snapshots', { keyPath: 'id' })
      snaps.createIndex('byCreated', 'createdAt')
    },
  })
}

export async function loadAll(db: DB): Promise<Dataset> {
  const tx = db.transaction(['lives', 'entries'])
  const [lives, entries] = await Promise.all([tx.objectStore('lives').getAll(), tx.objectStore('entries').getAll()])
  await tx.done
  return { lives, entries }
}

export class LifeRemovedError extends Error {
  constructor() {
    super('这个人已被移除，修改没有保存。')
  }
}

export async function createLife(db: DB, life: Life): Promise<void> {
  await db.add('lives', life)
}

export async function updateLife(db: DB, life: Life): Promise<void> {
  const tx = db.transaction('lives', 'readwrite')
  try {
    if (!(await tx.store.get(life.id))) throw new LifeRemovedError()
    await tx.store.put(life)
    await tx.done
  } catch (err) {
    try { tx.abort() } catch {}
    await tx.done.catch(() => {})
    throw err
  }
}

/** Removes one life and only its own entries, atomically. Returns the number of entries removed. */
export async function deleteLife(db: DB, lifeId: string): Promise<number> {
  const tx = db.transaction(['lives', 'entries'], 'readwrite')
  const keys = await tx.objectStore('entries').index('byLife').getAllKeys(lifeId)
  await Promise.all([...keys.map((k) => tx.objectStore('entries').delete(k)), tx.objectStore('lives').delete(lifeId)])
  await tx.done
  return keys.length
}

export async function putEntry(db: DB, entry: WeekEntry): Promise<void> {
  const tx = db.transaction(['lives', 'entries'], 'readwrite')
  try {
    if (!(await tx.objectStore('lives').get(entry.lifeId))) throw new LifeRemovedError()
    await tx.objectStore('entries').put(entry)
    await tx.done
  } catch (err) {
    try { tx.abort() } catch {}
    await tx.done.catch(() => {})
    throw err
  }
}

export async function deleteEntry(db: DB, lifeId: string, week: string): Promise<void> {
  await db.delete('entries', [lifeId, week])
}

export function sameEntry(a: WeekEntry | undefined, b: WeekEntry | undefined): boolean {
  if (!a || !b) return a === b
  return a.lifeId === b.lifeId && a.week === b.week && a.updatedAt === b.updatedAt
    && a.text === b.text && a.color === b.color && a.emoji === b.emoji
    && a.milestone === b.milestone && a.met === b.met
}

export async function compareAndSaveEntry(db: DB, entry: WeekEntry, expected: WeekEntry | undefined) {
  const tx = db.transaction(['lives', 'entries'], 'readwrite')
  try {
    if (!(await tx.objectStore('lives').get(entry.lifeId))) throw new LifeRemovedError()
    const store = tx.objectStore('entries')
    const key: [string, string] = [entry.lifeId, entry.week]
    const current = await store.get(key)
    if (!sameEntry(current, expected)) {
      await tx.done
      return { conflict: true as const, entry: current }
    }
    const empty = isEntryEmpty(entry)
    if (empty) await store.delete(key)
    else await store.put(entry)
    await tx.done
    return { conflict: false as const, entry: empty ? undefined : entry }
  } catch (err) {
    try { tx.abort() } catch {}
    await tx.done.catch(() => {})
    throw err
  }
}

export async function replaceAll(db: DB, data: Dataset): Promise<void> {
  const tx = db.transaction(['lives', 'entries'], 'readwrite')
  const lives = tx.objectStore('lives')
  const entries = tx.objectStore('entries')
  await Promise.all([lives.clear(), entries.clear()])
  await Promise.all([...data.lives.map(async (l) => lives.put(l)), ...data.entries.map(async (e) => entries.put(e))])
  await tx.done
}

export async function getMeta<T>(db: DB, key: string): Promise<T | undefined> {
  return (await db.get('meta', key))?.value as T | undefined
}

export async function setMeta(db: DB, key: string, value: unknown): Promise<void> {
  await db.put('meta', { key, value })
}

type ArchiveTx = IDBPTransaction<Schema, ['lives', 'entries', 'snapshots'], 'readwrite'>

async function readArchive(tx: ArchiveTx): Promise<Dataset> {
  const [lives, entries] = await Promise.all([tx.objectStore('lives').getAll(), tx.objectStore('entries').getAll()])
  return { lives, entries }
}

async function snapshotInTransaction(tx: ArchiveTx, data: Dataset, reason: string): Promise<Snapshot> {
  const store = tx.objectStore('snapshots')
  const last = await store.index('byCreated').openCursor(null, 'prev')
  const createdAt = Math.max(Date.now(), (last?.value.createdAt ?? 0) + 1)
  const snap: Snapshot = { id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`, createdAt, reason, data: buildBackup(data) }
  await store.put(snap)
  const all = await store.index('byCreated').getAllKeys()
  for (let i = 0; i < all.length - MAX_SNAPSHOTS; i++) await store.delete(all[i])
  return snap
}

async function replaceInTransaction(tx: ArchiveTx, data: Dataset): Promise<void> {
  const lives = tx.objectStore('lives')
  const entries = tx.objectStore('entries')
  await Promise.all([lives.clear(), entries.clear()])
  await Promise.all([...data.lives.map(async (l) => lives.put(l)), ...data.entries.map(async (e) => entries.put(e))])
}

export async function saveSnapshot(db: DB, reason: string): Promise<Snapshot> {
  const tx = db.transaction(['lives', 'entries', 'snapshots'], 'readwrite')
  const snap = await snapshotInTransaction(tx, await readArchive(tx), reason)
  await tx.done
  return snap
}

export type ImportMode = 'keep-local' | 'overwrite-conflicts' | 'replace'
export type ImportResult = { status: 'review'; local: Dataset; plan: ImportPlan } | { status: 'applied'; plan: ImportPlan }

export async function commitImport(db: DB, incoming: Dataset, reviewed: Dataset, mode: ImportMode): Promise<ImportResult> {
  // The archive lock covers revalidation, snapshot and replacement; tabs cannot write between them.
  const tx = db.transaction(['lives', 'entries', 'snapshots'], 'readwrite')
  try {
    const local = await readArchive(tx)
    const plan = analyzeImport(local, incoming)
    if (datasetSignature(local) !== datasetSignature(reviewed)) {
      await tx.done
      return { status: 'review', local, plan }
    }
    const next = mode === 'replace' ? incoming : mergeDatasets(local, plan, mode === 'overwrite-conflicts')
    await snapshotInTransaction(tx, local, '导入前自动保存')
    await replaceInTransaction(tx, next)
    await tx.done
    return { status: 'applied', plan }
  } catch (err) {
    try { tx.abort() } catch {}
    await tx.done.catch(() => {})
    throw err
  }
}

export async function restoreArchive(db: DB, data: Dataset): Promise<void> {
  const tx = db.transaction(['lives', 'entries', 'snapshots'], 'readwrite')
  try {
    await snapshotInTransaction(tx, await readArchive(tx), '恢复快照前自动保存')
    await replaceInTransaction(tx, data)
    await tx.done
  } catch (err) {
    try { tx.abort() } catch {}
    await tx.done.catch(() => {})
    throw err
  }
}

export async function listSnapshots(db: DB): Promise<Snapshot[]> {
  const all = await db.getAllFromIndex('snapshots', 'byCreated')
  return all.reverse()
}
