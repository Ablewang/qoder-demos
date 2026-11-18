import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Life } from '../lib/model'
import { weekIdOf } from '../lib/date'
import { buildBackup, type Dataset } from '../db/backup'
import type { DB, ImportMode } from '../db/db'

const person = (id: string): Life => ({ id, name: id, relation: 'other', birthDate: '1990-01-01', drawToAge: 90, showFuture: false, color: 'slate', order: 0, createdAt: 1, updatedAt: 1 })
const original: Dataset = { lives: [person('a')], entries: [] }
const incoming: Dataset = { lives: [person('a')], entries: [{ lifeId: 'a', week: '2026-11-16', text: '导入记录', updatedAt: 1 }] }
const canonical = (data: Dataset) => buildBackup(data, new Date(0))
const fault = () => new DOMException('synthetic post-commit failure', 'QuotaExceededError')
let seq = 0
let db: DB
let api: typeof import('../db/db')
let store: typeof import('./store')
let postMessage: ReturnType<typeof vi.fn>

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  postMessage = vi.fn()
  vi.stubGlobal('BroadcastChannel', class { postMessage = postMessage; addEventListener = vi.fn() })
  vi.stubGlobal('document', { addEventListener: vi.fn(), visibilityState: 'visible' })
  vi.stubGlobal('navigator', { storage: { persist: vi.fn().mockResolvedValue(false) } })
  api = await import('../db/db')
  db = await api.openAppDB(`store-test-${seq++}`)
  await api.replaceAll(db, original)
  vi.spyOn(api, 'openAppDB').mockResolvedValue(db)
  store = await import('./store')
  await store.initStore()
})

afterEach(() => {
  db?.close()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function abortNextArchive() {
  const transaction = IDBDatabase.prototype.transaction
  vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, names, mode, options) {
    const tx = transaction.call(this, names, mode, options)
    if (mode === 'readwrite' && Array.isArray(names) && names.includes('snapshots')) queueMicrotask(() => tx.abort())
    return tx
  })
}

describe('committed writes and post-commit synchronization', () => {
  it.each<ImportMode>(['keep-local', 'overwrite-conflicts', 'replace'])('reports applied %s despite one metadata write failure and publishes actual data', async (mode) => {
    const reviewed = await store.planImport(incoming)
    vi.spyOn(api, 'setMeta').mockRejectedValueOnce(fault())
    const result = await store.applyImport(incoming, reviewed.local, mode)
    expect(result.status).toBe('applied')
    if (result.status !== 'applied') throw new Error('Expected committed import')
    expect(result.warning).toContain('数据已写入本机')
    expect(result.warning).toContain('无需重复')
    expect(canonical(await api.loadAll(db))).toEqual(canonical(incoming))
    expect(canonical(store.currentDataset())).toEqual(canonical(incoming))
    const snaps = await api.listSnapshots(db)
    expect(snaps).toHaveLength(1)
    expect(canonical(snaps[0].data)).toEqual(canonical(original))
    expect(postMessage).toHaveBeenCalledWith('changed')
  })

  it('retries a one-time archive read failure without repeating the committed import', async () => {
    const reviewed = await store.planImport(incoming)
    vi.spyOn(api, 'loadAll').mockRejectedValueOnce(fault())
    const result = await store.applyImport(incoming, reviewed.local, 'keep-local')
    expect(result.status).toBe('applied')
    expect(store.getState().writeWarning).toContain('现已重新读取')
    expect(canonical(store.currentDataset())).toEqual(canonical(await api.loadAll(db)))
    expect(await api.listSnapshots(db)).toHaveLength(1)
  })

  it('exposes repeated read failure after commit and recovers through read-only refresh', async () => {
    const reviewed = await store.planImport(incoming)
    vi.spyOn(api, 'loadAll').mockRejectedValueOnce(fault()).mockRejectedValueOnce(fault())
    const result = await store.applyImport(incoming, reviewed.local, 'keep-local')
    expect(result.status).toBe('applied')
    expect(store.getState().writeWarning).toContain('页面还未读到最新存档')
    expect(store.currentDataset().entries).toEqual([])
    expect(canonical(await api.loadAll(db))).toEqual(canonical(incoming))
    await store.refreshStore()
    expect(store.getState().writeWarning).toBeUndefined()
    expect(canonical(store.currentDataset())).toEqual(canonical(incoming))
    expect(await api.listSnapshots(db)).toHaveLength(1)
  })

  it('publishes the archive even if metadata reads fail', async () => {
    const reviewed = await store.planImport(incoming)
    vi.spyOn(api, 'getMeta').mockResolvedValueOnce(true).mockRejectedValueOnce(fault())
    expect((await store.applyImport(incoming, reviewed.local, 'keep-local')).status).toBe('applied')
    expect(canonical(store.currentDataset())).toEqual(canonical(incoming))
    expect(store.getState().writeWarning).toContain('保存时间等信息未能读取')
  })

  it('reports notification failure without classifying the archive write as failed', async () => {
    postMessage.mockImplementationOnce(() => { throw new Error('synthetic closed channel') })
    const reviewed = await store.planImport(incoming)
    expect((await store.applyImport(incoming, reviewed.local, 'keep-local')).status).toBe('applied')
    expect(store.getState().writeWarning).toContain('其他标签页未收到通知')
    expect(canonical(store.currentDataset())).toEqual(canonical(await api.loadAll(db)))
  })

  it('rejects a real archive abort before commit with unchanged data and snapshots', async () => {
    const reviewed = await store.planImport(incoming)
    abortNextArchive()
    await expect(store.applyImport(incoming, reviewed.local, 'replace')).rejects.toMatchObject({ name: 'AbortError' })
    expect(canonical(await api.loadAll(db))).toEqual(canonical(original))
    expect(canonical(store.currentDataset())).toEqual(canonical(original))
    expect(await api.listSnapshots(db)).toEqual([])
    expect(store.getState().writeWarning).toBeUndefined()
    expect(postMessage).not.toHaveBeenCalled()
  })

  it.each(['metadata', 'read'])('restoration remains committed after a one-time %s failure', async (kind) => {
    const snap = await api.saveSnapshot(db, '测试恢复目标')
    await api.replaceAll(db, incoming)
    await store.refreshStore()
    if (kind === 'metadata') vi.spyOn(api, 'setMeta').mockRejectedValueOnce(fault())
    else vi.spyOn(api, 'loadAll').mockRejectedValueOnce(fault())
    const result = await store.restoreSnapshot(snap)
    expect(result.warning).toContain('数据已写入本机')
    expect(canonical(await api.loadAll(db))).toEqual(canonical(original))
    expect(canonical(store.currentDataset())).toEqual(canonical(original))
    const snaps = await api.listSnapshots(db)
    expect(snaps).toHaveLength(2)
    expect(snaps[0].reason).toBe('恢复快照前自动保存')
    expect(canonical(snaps[0].data)).toEqual(canonical(incoming))
  })

  it('rejects a real restore abort without changing data or pruning snapshots', async () => {
    const snap = await api.saveSnapshot(db, '测试恢复目标')
    await api.replaceAll(db, incoming)
    await store.refreshStore()
    const snaps = await api.listSnapshots(db)
    abortNextArchive()
    await expect(store.restoreSnapshot(snap)).rejects.toMatchObject({ name: 'AbortError' })
    expect(canonical(await api.loadAll(db))).toEqual(canonical(incoming))
    expect(await api.listSnapshots(db)).toEqual(snaps)
    expect(store.getState().writeWarning).toBeUndefined()
  })

  it.each(['create', 'edit', 'entry', 'delete'])('does not reject a committed %s after metadata failure', async (operation) => {
    vi.spyOn(api, 'setMeta').mockRejectedValueOnce(fault())
    if (operation === 'create') await store.createLife(person('new'))
    if (operation === 'edit') await store.saveLife({ ...person('a'), name: '已修改' })
    if (operation === 'entry') await store.saveEntry('a', weekIdOf('2026-11-16'), { text: '已写周记录' })
    if (operation === 'delete') await store.removeLife('a')
    expect(store.getState().writeWarning).toContain('数据已写入本机')
    expect(canonical(store.currentDataset())).toEqual(canonical(await api.loadAll(db)))
    const persisted = await api.loadAll(db)
    if (operation === 'create') expect(persisted.lives.some(l => l.id === 'new')).toBe(true)
    if (operation === 'edit') expect(persisted.lives[0].name).toBe('已修改')
    if (operation === 'entry') expect(persisted.entries[0].text).toBe('已写周记录')
    if (operation === 'delete') expect(persisted.lives).toEqual([])
  })

  it('exports the committed database after both publication reads fail, without advancing the backup marker', async () => {
    vi.spyOn(api, 'loadAll').mockRejectedValueOnce(fault()).mockRejectedValueOnce(fault())
    await store.saveEntry('a', weekIdOf('2026-11-16'), { text: '已提交但内存未更新' })
    expect(store.currentDataset().entries).toEqual([])
    const file = await store.exportFile()
    expect(file.entries[0].text).toBe('已提交但内存未更新')
    expect(canonical(file)).toEqual(canonical(await api.loadAll(db)))
    expect(await api.getMeta(db, 'lastBackupAt')).toBeUndefined()
  })

  it('reads export lives and entries in one readonly transaction', async () => {
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction')
    await store.exportFile()
    expect(transaction).toHaveBeenCalledTimes(1)
    const [names, mode] = transaction.mock.calls[0]
    expect(names).toEqual(['lives', 'entries'])
    expect(mode).not.toBe('readwrite')
  })

  it('rejects an unreadable export rather than returning cached data or advancing the marker', async () => {
    vi.spyOn(api, 'loadAll').mockRejectedValueOnce(fault())
    await expect(store.exportFile()).rejects.toThrow()
    expect(await api.getMeta(db, 'lastBackupAt')).toBeUndefined()
    expect(store.getState().lastBackupAt).toBeUndefined()
  })

  it('does not fabricate a backup marker after its metadata write fails', async () => {
    await store.markBackedUp(100)
    vi.spyOn(api, 'setMeta').mockRejectedValueOnce(fault())
    await expect(store.markBackedUp(200)).rejects.toThrow()
    expect(store.getState().lastBackupAt).toBe(100)
    expect(await api.getMeta(db, 'lastBackupAt')).toBe(100)
  })

  it('publishes a successfully stored snapshot-time marker without an unrelated archive reread', async () => {
    const read = vi.spyOn(api, 'loadAll').mockRejectedValue(fault())
    await store.markBackedUp(123)
    expect(read).not.toHaveBeenCalled()
    expect(store.getState().lastBackupAt).toBe(123)
    expect(await api.getMeta(db, 'lastBackupAt')).toBe(123)
  })

  it.each(['clear', 'replace'])('does not automatically resurrect a stale draft after an external %s', async (operation) => {
    const week = weekIdOf('2026-11-16')
    await store.saveEntry('a', week, { text: '旧条目' })
    const expected = store.getEntry('a', week)
    if (operation === 'clear') await api.deleteEntry(db, 'a', '2026-11-16')
    else await api.replaceAll(db, incoming)
    const before = await api.loadAll(db)
    const meta = vi.spyOn(api, 'setMeta')
    const result = await store.saveEntry('a', week, { text: '待保存旧草稿' }, { expected })
    expect(result.conflict).toBe(true)
    expect(await api.loadAll(db)).toEqual(before)
    expect(meta).not.toHaveBeenCalled()
  })

  it('compares content even when external entry timestamps are equal', async () => {
    const before = { lifeId: 'a', week: '2026-11-16', text: 'A', updatedAt: 10 }
    await api.putEntry(db, { ...before, text: 'B' })
    const result = await store.saveEntry('a', weekIdOf(before.week), { text: 'C' }, { expected: before })
    expect(result.conflict).toBe(true)
    expect((await api.loadAll(db)).entries[0].text).toBe('B')
  })

  it('saves an unchanged baseline and permits an explicitly chosen conflict resolution', async () => {
    const week = weekIdOf('2026-11-16')
    expect((await store.saveEntry('a', week, { text: '新条目' }, { expected: undefined })).conflict).toBe(false)
    const old = store.getEntry('a', week)
    await api.putEntry(db, { ...old!, text: '外部条目', updatedAt: 2 })
    const result = await store.saveEntry('a', week, { text: '本地草稿' }, { expected: old })
    expect(result.conflict).toBe(true)
    expect((await store.saveEntry('a', week, { text: '明确覆盖' }, { expected: result.entry })).conflict).toBe(false)
    expect((await api.loadAll(db)).entries[0].text).toBe('明确覆盖')
  })

  it('aborts a guarded autosave without changing the archive or running post-commit work', async () => {
    const originalTransaction = IDBDatabase.prototype.transaction
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, names, mode, options) {
      const tx = originalTransaction.call(this, names, mode, options)
      if (mode === 'readwrite' && Array.isArray(names) && names.includes('entries')) queueMicrotask(() => tx.abort())
      return tx
    })
    const meta = vi.spyOn(api, 'setMeta')
    await expect(store.saveEntry('a', weekIdOf('2026-11-16'), { text: '事务中止' }, { expected: undefined })).rejects.toMatchObject({ name: 'AbortError' })
    expect(canonical(await api.loadAll(db))).toEqual(canonical(original))
    expect(meta).not.toHaveBeenCalled()
  })

  it('keeps the missing-person guard for autosave including empty drafts', async () => {
    await api.deleteLife(db, 'a')
    await expect(store.saveEntry('a', weekIdOf('2026-11-16'), {}, { expected: undefined })).rejects.toBeInstanceOf(api.LifeRemovedError)
    expect(await api.loadAll(db)).toEqual({ lives: [], entries: [] })
  })

  it('does not fall back from missing-person edit to creation or post-write work', async () => {
    await api.deleteLife(db, 'a')
    const meta = vi.spyOn(api, 'setMeta')
    await expect(store.saveLife({ ...person('a'), companionOn: true })).rejects.toBeInstanceOf(api.LifeRemovedError)
    expect(await api.loadAll(db)).toEqual({ lives: [], entries: [] })
    expect(meta).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()
  })
})
