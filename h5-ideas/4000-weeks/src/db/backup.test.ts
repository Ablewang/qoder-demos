import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import type { Life, WeekEntry } from '../lib/model'
import { analyzeImport, buildBackup, mergeDatasets, validateBackup, type Dataset } from './backup'
import { commitImport, createLife, deleteEntry, deleteLife, LifeRemovedError, listSnapshots, loadAll, openAppDB, putEntry, replaceAll, restoreArchive, saveSnapshot, updateLife, type DB, type ImportMode } from './db'

const today = '2026-11-17'
const life = (id: string, p: Partial<Life> = {}): Life => ({
  id,
  name: id,
  relation: 'other',
  birthDate: '1990-01-01',
  drawToAge: 90,
  showFuture: false,
  color: 'slate',
  order: 0,
  createdAt: 1,
  updatedAt: 1,
  ...p,
})
const entry = (lifeId: string, week: string, text: string, updatedAt = 1): WeekEntry => ({ lifeId, week, text, updatedAt })
const roundTrip = (d: Dataset) => {
  const v = validateBackup(JSON.parse(JSON.stringify(buildBackup(d))), today)
  if (!v.ok) throw new Error(v.error)
  return v
}

let dbSeq = 0
const freshDb = () => openAppDB(`test-${dbSeq++}`)

describe('validateBackup', () => {
  it('rejects foreign or future files', () => {
    expect(validateBackup({}, today).ok).toBe(false)
    expect(validateBackup({ app: 'x', schemaVersion: 1, lives: [], entries: [] }, today).ok).toBe(false)
    expect(validateBackup({ app: 'one-week-one-cell', schemaVersion: 99, lives: [], entries: [] }, today).ok).toBe(false)
    expect(validateBackup({ app: 'one-week-one-cell', schemaVersion: 1, lives: {} }, today).ok).toBe(false)
  })

  it('drops invalid records with warnings instead of failing silently', () => {
    const r = validateBackup(
      {
        app: 'one-week-one-cell',
        schemaVersion: 1,
        lives: [
          { ...life('a'), hacker: '<script>' },
          life('future', { birthDate: '2030-01-01' }),
          life('kid', { relation: 'child', showFuture: true }),
          life('me1', { relation: 'self' }),
          life('me2', { relation: 'self' }),
        ],
        entries: [
          entry('a', '2026-11-16', 'ok'),
          entry('a', '2026-11-17', 'not monday'),
          entry('ghost', '2026-11-16', 'orphan'),
          entry('a', '2026-11-09', 'x'.repeat(600)),
        ],
      },
      today,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.lives.map((l) => l.id)).toEqual(['a', 'kid', 'me1', 'me2'])
    expect('hacker' in r.data.lives[0]).toBe(false)
    expect(r.data.lives.find((l) => l.id === 'kid')!.showFuture).toBe(false)
    expect(r.data.lives.find((l) => l.id === 'me2')!.relation).toBe('other')
    expect(r.data.entries).toHaveLength(2)
    expect(r.data.entries.find((e) => e.week === '2026-11-09')!.text).toHaveLength(500)
    expect(r.warnings.length).toBeGreaterThanOrEqual(4)
  })
})

describe('import merge', () => {
  const local: Dataset = {
    lives: [life('me', { relation: 'self' }), life('kid', { relation: 'child', order: 1 })],
    entries: [entry('me', '2026-11-16', '本机写的'), entry('kid', '2026-11-16', '会走路了')],
  }

  it('classifies added, identical and conflicting records', () => {
    const incoming: Dataset = {
      lives: [life('me', { relation: 'self' }), life('kid', { relation: 'child', name: '小满' }), life('mom', { relation: 'parent' })],
      entries: [entry('me', '2026-11-16', '备份里写的', 99), entry('kid', '2026-11-16', '会走路了', 50), entry('me', '2026-11-09', '上周')],
    }
    const plan = analyzeImport(local, incoming)
    expect(plan.lives.added.map((l) => l.id)).toEqual(['mom'])
    expect(plan.lives.same.map((l) => l.id)).toEqual(['me'])
    expect(plan.lives.conflicts.map((c) => c.local.id)).toEqual(['kid'])
    expect(plan.entries.added).toHaveLength(1)
    expect(plan.entries.same).toHaveLength(1)
    expect(plan.entries.conflicts).toHaveLength(1)
  })

  it('never overwrites local records unless asked, even if the backup is newer', () => {
    const incoming: Dataset = { lives: [life('kid', { relation: 'child', name: '小满' })], entries: [entry('me', '2026-11-16', '备份里写的', 999)] }
    const plan = analyzeImport(local, incoming)
    const kept = mergeDatasets(local, plan, false)
    expect(kept.entries.find((e) => e.lifeId === 'me')!.text).toBe('本机写的')
    expect(kept.lives.find((l) => l.id === 'kid')!.name).toBe('kid')
    const over = mergeDatasets(local, plan, true)
    expect(over.entries.find((e) => e.lifeId === 'me')!.text).toBe('备份里写的')
    expect(over.lives.find((l) => l.id === 'kid')!.name).toBe('小满')
  })

  it.each([false, true])('does not overwrite existing life ids or entry keys from stale added records (overwrite=%s)', (overwrite) => {
    const reviewed: Dataset = { lives: [life('a')], entries: [] }
    const incoming: Dataset = {
      lives: [life('new', { name: '备份人物' }), life('missing')],
      entries: [entry('a', '2026-11-16', '备份记录'), entry('new', '2026-11-16', '备份人物记录'), entry('missing', '2026-11-16', '真正新增')],
    }
    const stalePlan = analyzeImport(reviewed, incoming)
    expect(stalePlan.lives.added).toEqual(incoming.lives)
    expect(stalePlan.entries.added).toEqual(incoming.entries)
    expect(stalePlan.lives.conflicts).toEqual([])
    expect(stalePlan.entries.conflicts).toEqual([])

    const current: Dataset = {
      lives: [life('a'), life('new', { name: '本机新人物', relation: 'self', order: 7, updatedAt: 99 })],
      entries: [entry('a', '2026-11-16', '本机新记录', 99), entry('new', '2026-11-16', '本机人物记录', 99)],
    }
    expect(mergeDatasets(current, stalePlan, overwrite)).toEqual({
      lives: [...current.lives, life('missing', { order: 8 })],
      entries: [...current.entries, entry('missing', '2026-11-16', '真正新增')],
    })
  })

  it('imports a second "self" as "other"', () => {
    const plan = analyzeImport(local, { lives: [life('other-me', { relation: 'self' })], entries: [] })
    const merged = mergeDatasets(local, plan, false)
    expect(merged.lives.filter((l) => l.relation === 'self').map((l) => l.id)).toEqual(['me'])
    expect(plan.warnings.length).toBe(1)
  })
})

describe('atomic archive imports', () => {
  const modes: ImportMode[] = ['keep-local', 'overwrite-conflicts', 'replace']
  const canonical = (data: Dataset) => buildBackup(data, new Date(0))

  it.each(modes)('requires review of a newly persisted entry before applying %s', async (mode) => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const original: Dataset = {
        lives: [life('a'), life('local-only', { order: 1 })],
        entries: [entry('a', '2026-11-09', '已有记录'), entry('local-only', '2026-11-16', '只在本机')],
      }
      const backupEntry = entry('a', '2026-11-16', '旧备份记录')
      const extraEntry = entry('a', '2026-11-02', '备份新增记录')
      const incoming: Dataset = { lives: [life('a')], entries: [backupEntry, extraEntry] }
      await replaceAll(db, original)
      const reviewed = await loadAll(db)
      expect(analyzeImport(reviewed, incoming).entries.added).toEqual(incoming.entries)

      const newEntry = entry('a', '2026-11-16', '另一连接新记录', 99)
      await putEntry(other, newEntry)
      const latest: Dataset = { lives: original.lives, entries: [...original.entries, newEntry] }
      const result = await commitImport(db, incoming, reviewed, mode)
      expect(result.status).toBe('review')
      if (result.status !== 'review') throw new Error('Expected a fresh review')
      expect(canonical(result.local)).toEqual(canonical(latest))
      expect(result.plan).toEqual(analyzeImport(latest, incoming))
      expect(result.plan.entries.added).toEqual([extraEntry])
      expect(result.plan.entries.conflicts).toEqual([{ local: newEntry, incoming: backupEntry }])
      expect(canonical(await loadAll(other))).toEqual(canonical(latest))
      expect(await listSnapshots(other)).toEqual([])

      const applied = await commitImport(db, incoming, result.local, mode)
      expect(applied).toEqual({ status: 'applied', plan: analyzeImport(latest, incoming) })
      const expected: Dataset = mode === 'replace' ? incoming : {
        lives: original.lives,
        entries: [...original.entries, mode === 'keep-local' ? newEntry : backupEntry, extraEntry],
      }
      expect(canonical(await loadAll(other))).toEqual(canonical(expected))
      const snapshots = await listSnapshots(other)
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].reason).toBe('导入前自动保存')
      expect(canonical(snapshots[0].data)).toEqual(canonical(latest))

      if (mode === 'replace') {
        await restoreArchive(db, snapshots[0].data)
        expect(canonical(await loadAll(other))).toEqual(canonical(latest))
        const restoredSnapshots = await listSnapshots(other)
        expect(restoredSnapshots).toHaveLength(2)
        expect(restoredSnapshots[0].reason).toBe('恢复快照前自动保存')
        expect(canonical(restoredSnapshots[0].data)).toEqual(canonical(incoming))
        expect(restoredSnapshots[1]).toEqual(snapshots[0])
      }
    } finally {
      other.close()
      db.close()
    }
  })

  it.each([
    { name: 'an added life becoming a conflict', write: (db: DB) => createLife(db, life('new', { name: '另一连接人物', updatedAt: 99 })) },
    { name: 'an existing life being modified', write: (db: DB) => updateLife(db, life('a', { name: '修改后人物', updatedAt: 99 })) },
    { name: 'an existing entry being modified', write: (db: DB) => putEntry(db, entry('a', '2026-11-16', '修改后记录', 99)) },
    { name: 'a life and its entries being deleted', write: (db: DB) => deleteLife(db, 'a') },
    { name: 'an entry being deleted', write: (db: DB) => deleteEntry(db, 'a', '2026-11-16') },
    { name: 'an unrelated entry being written', write: (db: DB) => putEntry(db, entry('b', '2026-11-09', '无关新增', 99)) },
    { name: 'an unrelated life being written', write: (db: DB) => createLife(db, life('unrelated')) },
    { name: 'only life metadata changing', write: (db: DB) => updateLife(db, life('a', { order: 7, createdAt: 2, updatedAt: 99 })) },
    { name: 'only entry metadata changing', write: (db: DB) => putEntry(db, entry('a', '2026-11-16', '原记录', 99)) },
  ])('requires review without changing archive or snapshots after $name', async ({ write }) => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const original: Dataset = {
        lives: [life('a'), life('b', { order: 1 })],
        entries: [entry('a', '2026-11-16', '原记录'), entry('b', '2026-11-16', '无关记录')],
      }
      const incoming: Dataset = {
        lives: [life('a'), life('new', { name: '备份人物' })],
        entries: [entry('a', '2026-11-16', '原记录'), entry('a', '2026-11-09', '备份新增')],
      }
      await replaceAll(db, original)
      await saveSnapshot(db, '已有快照')
      const reviewed = await loadAll(db)
      const snapshots = await listSnapshots(db)
      await write(other)
      const latest = await loadAll(other)
      expect(canonical(latest)).not.toEqual(canonical(reviewed))

      const result = await commitImport(db, incoming, reviewed, 'keep-local')
      expect(result.status).toBe('review')
      if (result.status !== 'review') throw new Error('Expected a fresh review')
      expect(result.local).toEqual(latest)
      expect(result.plan).toEqual(analyzeImport(latest, incoming))
      expect(await loadAll(other)).toEqual(latest)
      expect(await listSnapshots(other)).toEqual(snapshots)
    } finally {
      other.close()
      db.close()
    }
  })

  it.each(modes)('retains a putEntry queued after %s and snapshots the exact pre-import archive', async (mode) => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const original: Dataset = {
        lives: [life('a', { name: '导入前人物', updatedAt: 7 }), life('local-only', { order: 1 })],
        entries: [entry('a', '2026-11-16', '导入前记录', 7), entry('local-only', '2026-11-09', '本机独有记录', 8)],
      }
      const incoming: Dataset = {
        lives: [life('a', { name: '备份人物', updatedAt: 1 })],
        entries: [entry('a', '2026-11-16', '备份记录'), entry('a', '2026-11-02', '导入新增')],
      }
      await replaceAll(db, original)
      const reviewed = await loadAll(db)
      const queuedEntry = entry('a', '2026-11-16', '导入后排队写入', 100)
      // commitImport creates its readwrite transaction synchronously, before this putEntry.
      const importing = commitImport(db, incoming, reviewed, mode)
      const writing = putEntry(other, queuedEntry)
      const [result] = await Promise.all([importing, writing])
      expect(result).toEqual({ status: 'applied', plan: analyzeImport(original, incoming) })
      const expected: Dataset = {
        lives: mode === 'replace' ? incoming.lives : mode === 'keep-local' ? original.lives : [incoming.lives[0], original.lives[1]],
        entries: [queuedEntry, incoming.entries[1], ...(mode === 'replace' ? [] : [original.entries[1]])],
      }
      expect(canonical(await loadAll(other))).toEqual(canonical(expected))
      const snapshots = await listSnapshots(other)
      expect(snapshots).toHaveLength(1)
      expect(snapshots[0].reason).toBe('导入前自动保存')
      expect(canonical(snapshots[0].data)).toEqual(canonical(original))
    } finally {
      other.close()
      db.close()
    }
  })

  it.each(['replace import', 'restore'])('rejects a queued entry for a life removed by %s without creating an orphan', async (operation) => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const original: Dataset = { lives: [life('a'), life('removed')], entries: [entry('removed', '2026-11-16', '移除前记录')] }
      const incoming: Dataset = { lives: [life('a')], entries: [] }
      await replaceAll(db, original)
      const reviewed = await loadAll(db)
      const replacing = operation === 'restore' ? restoreArchive(db, incoming) : commitImport(db, incoming, reviewed, 'replace')
      const writing = putEntry(other, entry('removed', '2026-11-16', '旧页面排队保存'))
      const [replacement, write] = await Promise.allSettled([replacing, writing])
      expect(replacement.status).toBe('fulfilled')
      expect(write.status).toBe('rejected')
      if (write.status === 'rejected') {
        expect(write.reason).toBeInstanceOf(LifeRemovedError)
        expect(write.reason.message).toContain('这个人已被移除')
      }
      expect(await loadAll(other)).toEqual(incoming)
      const snapshots = await listSnapshots(other)
      expect(snapshots).toHaveLength(1)
      expect(canonical(snapshots[0].data)).toEqual(canonical(original))
    } finally {
      other.close()
      db.close()
    }
  })

  it.each(['replace import', 'delete', 'restore'] as const)('rejects a stale PersonForm update queued after %s removes its parent', async (operation) => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const original: Dataset = {
        lives: [life('a', { relation: 'parent', name: '移除前人物' }), life('b', { order: 1 })],
        entries: [entry('a', '2026-11-16', '移除前记录'), entry('b', '2026-11-09', '保留记录')],
      }
      const incoming: Dataset = {
        lives: [life('b', { name: '替换后人物', order: 1 })],
        entries: [entry('b', '2026-11-16', '替换后记录')],
      }
      await replaceAll(db, original)
      await saveSnapshot(db, '已有快照')
      const previousSnapshots = await listSnapshots(db)
      const reviewed = await loadAll(db)
      const staleParent = (await loadAll(other)).lives.find((l) => l.id === 'a')!

      // Start the removal transaction synchronously before the other tab queues its stale edit.
      const removing = operation === 'replace import'
        ? commitImport(db, incoming, reviewed, 'replace')
        : operation === 'restore' ? restoreArchive(db, incoming) : deleteLife(db, 'a')
      const writing = updateLife(other, { ...staleParent, name: '旧表单提交', updatedAt: 99 })
      const [removal, write] = await Promise.allSettled([removing, writing])
      expect(removal.status).toBe('fulfilled')
      if (removal.status === 'fulfilled') {
        expect(removal.value).toEqual(operation === 'replace import'
          ? { status: 'applied', plan: analyzeImport(original, incoming) }
          : operation === 'delete' ? 1 : undefined)
      }
      expect(write).toMatchObject({ status: 'rejected', reason: expect.any(LifeRemovedError) })
      expect(await other.get('lives', 'a')).toBeUndefined()
      const expected: Dataset = operation === 'delete'
        ? { lives: [original.lives[1]], entries: [original.entries[1]] }
        : incoming
      expect(canonical(await loadAll(other))).toEqual(canonical(expected))
      const snapshots = await listSnapshots(other)
      if (operation === 'delete') {
        expect(snapshots).toEqual(previousSnapshots)
      } else {
        expect(snapshots).toHaveLength(previousSnapshots.length + 1)
        expect(snapshots[0].reason).toBe(operation === 'restore' ? '恢复快照前自动保存' : '导入前自动保存')
        expect(canonical(snapshots[0].data)).toEqual(canonical(original))
        expect(snapshots.slice(1)).toEqual(previousSnapshots)
      }

      await expect(putEntry(other, entry('a', '2026-11-16', '移除后周记录'))).rejects.toBeInstanceOf(LifeRemovedError)
      expect(await db.get('lives', 'a')).toBeUndefined()
      expect(canonical(await loadAll(db))).toEqual(canonical(expected))
      expect(await listSnapshots(db)).toEqual(snapshots)
    } finally {
      other.close()
      db.close()
    }
  })

  it.each([
    { operation: 'replace import', badKey: 'life' },
    { operation: 'replace import', badKey: 'entry' },
    { operation: 'restore', badKey: 'life' },
    { operation: 'restore', badKey: 'entry' },
  ])('rolls back archive, snapshot creation and pruning on an invalid $badKey key during $operation', async ({ operation, badKey }) => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const original: Dataset = {
        lives: [life('a'), life('b', { order: 1 })],
        entries: [entry('a', '2026-11-16', '不能丢失'), entry('b', '2026-11-09', '也不能丢失')],
      }
      await replaceAll(db, original)
      for (let i = 0; i < 3; i++) await saveSnapshot(db, `保留快照${i}`)
      const reviewed = await loadAll(db)
      const snapshots = await listSnapshots(db)
      expect(snapshots).toHaveLength(3)
      // Deliberately bypass the TypeScript key type to trigger IndexedDB DataError.
      const invalidKey = null as unknown as string
      const invalid: Dataset = {
        lives: [life('replacement'), ...(badKey === 'life' ? [life(invalidKey)] : [])],
        entries: [entry('replacement', '2026-11-16', '替换记录'), ...(badKey === 'entry' ? [entry('replacement', invalidKey, '坏周键')] : [])],
      }
      const replacing = operation === 'restore'
        ? restoreArchive(db, invalid)
        : commitImport(db, invalid, reviewed, 'replace')
      await expect(replacing).rejects.toMatchObject({ name: 'DataError' })
      expect(await loadAll(other)).toEqual(reviewed)
      expect(await listSnapshots(other)).toEqual(snapshots)
    } finally {
      other.close()
      db.close()
    }
  })
})

describe('IndexedDB life writes', () => {
  it('updates an existing life across tabs with last queued write winning, not newest timestamp', async () => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const original: Dataset = {
        lives: [life('a', { updatedAt: 100 }), life('b', { order: 1 })],
        entries: [entry('a', '2026-11-16', '保留记录'), entry('b', '2026-11-09', '无关记录')],
      }
      await replaceAll(db, original)
      await saveSnapshot(db, '编辑前')
      const snapshots = await listSnapshots(db)
      const stale = (await loadAll(other)).lives.find((l) => l.id === 'a')!
      const firstEdit = { ...original.lives[0], name: '先提交', updatedAt: 99 }
      const lastEdit = { ...stale, name: '后提交', color: 'sage' as const, updatedAt: 2 }
      const firstWrite = updateLife(db, firstEdit)
      const lastWrite = updateLife(other, lastEdit)
      await Promise.all([firstWrite, lastWrite])
      expect(await loadAll(db)).toEqual({ lives: [lastEdit, original.lives[1]], entries: original.entries })
      expect(await loadAll(other)).toEqual(await loadAll(db))
      expect(await listSnapshots(other)).toEqual(snapshots)
    } finally {
      other.close()
      db.close()
    }
  })

  it('persists companionOn toggles and companion settings for an existing parent', async () => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const parent = life('a', { relation: 'parent', companionOn: false })
      await createLife(db, parent)
      await putEntry(db, entry('a', '2026-11-16', '原记录'))
      const enabled: Life = {
        ...parent,
        companionOn: true,
        companion: { meetPerYear: 2, daysPerMeet: 4, toAge: 90, livesTogether: false },
        updatedAt: 2,
      }
      await updateLife(other, enabled)
      expect(await db.get('lives', 'a')).toEqual(enabled)
      const changed: Life = {
        ...enabled,
        companion: { meetPerYear: 12, daysPerMeet: 7, toAge: 95, livesTogether: true },
        updatedAt: 3,
      }
      await updateLife(db, changed)
      expect(await other.get('lives', 'a')).toEqual(changed)
      const disabled: Life = { ...changed, companionOn: false, updatedAt: 4 }
      await updateLife(other, disabled)
      expect(await loadAll(db)).toEqual({ lives: [disabled], entries: [entry('a', '2026-11-16', '原记录')] })
      expect(await listSnapshots(other)).toEqual([])
    } finally {
      other.close()
      db.close()
    }
  })

  it('rejects a companion settings update queued after another tab deletes the parent', async () => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const parent = life('a', {
        relation: 'parent',
        companionOn: false,
        companion: { meetPerYear: 2, daysPerMeet: 4, toAge: 90, livesTogether: false },
      })
      const original: Dataset = {
        lives: [parent, life('b', { order: 1 })],
        entries: [entry('a', '2026-11-16', '父母记录'), entry('b', '2026-11-16', '保留记录')],
      }
      await replaceAll(db, original)
      await saveSnapshot(db, '删除前')
      const snapshots = await listSnapshots(db)
      const staleParent = (await loadAll(other)).lives.find((l) => l.id === 'a')!
      const deleting = deleteLife(db, 'a')
      const writing = updateLife(other, {
        ...staleParent,
        companionOn: true,
        companion: { meetPerYear: 52, daysPerMeet: 1, toAge: 95, livesTogether: true },
        updatedAt: 99,
      })
      const [deletion, write] = await Promise.allSettled([deleting, writing])
      expect(deletion).toEqual({ status: 'fulfilled', value: 1 })
      expect(write).toMatchObject({ status: 'rejected', reason: expect.any(LifeRemovedError) })
      expect(await other.get('lives', 'a')).toBeUndefined()
      const expected = { lives: [original.lives[1]], entries: [original.entries[1]] }
      expect(await loadAll(other)).toEqual(expected)
      expect(await listSnapshots(other)).toEqual(snapshots)
      await expect(putEntry(other, { lifeId: 'a', week: '2026-11-16', met: true, updatedAt: 100 })).rejects.toBeInstanceOf(LifeRemovedError)
      expect(await loadAll(db)).toEqual(expected)
      expect(await listSnapshots(db)).toEqual(snapshots)
    } finally {
      other.close()
      db.close()
    }
  })

  it('creates a legitimate new life visible to another tab and allows its entries', async () => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const parent = life('new', { relation: 'parent', name: '新人物' })
      await createLife(db, parent)
      expect(await loadAll(other)).toEqual({ lives: [parent], entries: [] })
      const newEntry = entry('new', '2026-11-16', '新人物记录')
      await putEntry(other, newEntry)
      expect(await loadAll(db)).toEqual({ lives: [parent], entries: [newEntry] })
      expect(await listSnapshots(other)).toEqual([])
    } finally {
      other.close()
      db.close()
    }
  })

  it('rejects a queued duplicate create collision without overwriting the first life or other data', async () => {
    const db = await freshDb()
    const other = await openAppDB(db.name)
    try {
      const unrelated = life('unrelated')
      const unrelatedEntry = entry('unrelated', '2026-11-09', '保留记录')
      await createLife(db, unrelated)
      await putEntry(db, unrelatedEntry)
      await saveSnapshot(db, '创建前')
      const snapshots = await listSnapshots(db)
      const parent = life('new', { relation: 'parent', name: '先创建的人物' })
      const creating = createLife(db, parent)
      const colliding = createLife(other, life('new', { name: '不能覆盖', updatedAt: 999 }))
      const [creation, collision] = await Promise.allSettled([creating, colliding])
      expect(creation).toEqual({ status: 'fulfilled', value: undefined })
      expect(collision).toMatchObject({ status: 'rejected', reason: { name: 'ConstraintError' } })
      expect(await loadAll(other)).toEqual({ lives: [parent, unrelated], entries: [unrelatedEntry] })
      expect(await listSnapshots(other)).toEqual(snapshots)
      const newEntry = entry('new', '2026-11-16', '碰撞后仍可保存')
      await putEntry(other, newEntry)
      expect(await loadAll(db)).toEqual({ lives: [parent, unrelated], entries: [newEntry, unrelatedEntry] })
      expect(await listSnapshots(db)).toEqual(snapshots)
    } finally {
      other.close()
      db.close()
    }
  })
})

describe('IndexedDB archive', () => {
  it('deleting one life leaves every other life and entry untouched', async () => {
    const db = await freshDb()
    await createLife(db, life('a'))
    await createLife(db, life('b'))
    await putEntry(db, entry('a', '2026-11-16', 'A1'))
    await putEntry(db, entry('a', '2026-11-09', 'A2'))
    await putEntry(db, entry('b', '2026-11-16', 'B1'))
    const removed = await deleteLife(db, 'a')
    expect(removed).toBe(2)
    const data = await loadAll(db)
    expect(data.lives.map((l) => l.id)).toEqual(['b'])
    expect(data.entries).toEqual([entry('b', '2026-11-16', 'B1')])
  })

  it('export -> clear -> import reproduces the same backup', async () => {
    const db = await freshDb()
    const original: Dataset = {
      lives: [
        life('me', { relation: 'self', name: '我', showFuture: true }),
        life('mom', { relation: 'parent', companionOn: true, companion: { meetPerYear: 2, daysPerMeet: 4, toAge: 90, livesTogether: false }, order: 1 }),
        life('cat', { relation: 'pet', endDate: '2020-02-02', order: 2 }),
      ],
      entries: [{ ...entry('me', '2026-11-16', '一句话'), color: 'sun', emoji: '🌱', milestone: '搬家' }, { lifeId: 'mom', week: '2026-11-16', met: true, updatedAt: 3 }],
    }
    await replaceAll(db, original)
    const first = buildBackup(await loadAll(db), new Date(0))
    await replaceAll(db, { lives: [], entries: [] })
    expect((await loadAll(db)).lives).toHaveLength(0)
    const v = roundTrip(first)
    await replaceAll(db, v.data)
    const second = buildBackup(await loadAll(db), new Date(0))
    expect(second).toEqual(first)
    expect(v.warnings).toEqual([])
  })

  it('keeps only the latest snapshots', async () => {
    const db = await freshDb()
    await createLife(db, life('a'))
    for (let i = 0; i < 5; i++) await saveSnapshot(db, `s${i}`)
    const snaps = await listSnapshots(db)
    expect(snaps).toHaveLength(3)
    expect(snaps[0].reason).toBe('s4')
    expect(snaps[0].data.lives.map((l) => l.id)).toEqual(['a'])
  })
})
