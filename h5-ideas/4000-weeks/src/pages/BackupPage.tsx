import { useEffect, useState } from 'preact/hooks'
import { MAX_BACKUP_BYTES, backupFileName, validateBackup, type Dataset, type ImportPlan } from '../db/backup'
import type { Snapshot } from '../db/db'
import { formatWeekRange, weekIdOf } from '../lib/date'
import { RELATION_LABEL, type Life, type WeekEntry } from '../lib/model'
import { applyImport, exportFile, listSnapshots, markBackedUp, planImport, restoreSnapshot, useAppState, type ImportMode } from '../state/store'
import { Confirm, Modal, TabBar } from '../ui/ui'

type Pending = { name: string; data: Dataset; warnings: string[]; exportedAt?: string; local: Dataset; plan: ImportPlan; changed?: boolean }

const fmtTime = (t: number | string) => {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function entrySummary(e: WeekEntry) {
  return [e.emoji, e.text, e.milestone && `◆${e.milestone}`, e.met && '见到了'].filter(Boolean).join(' ') || '（仅颜色）'
}

const LIFE_FIELDS: Array<[keyof Life, string]> = [
  ['name', '称呼'],
  ['relation', '关系'],
  ['birthDate', '生日'],
  ['metDate', '相识'],
  ['endDate', '离开'],
  ['color', '颜色'],
  ['drawToAge', '画到'],
  ['showFuture', '未来格子'],
  ['companionOn', '陪伴计算'],
  ['companion', '陪伴假设'],
]

function lifeDiff(a: Life, b: Life) {
  const show = (k: keyof Life, v: unknown) => {
    if (v === undefined) return '无'
    if (k === 'relation') return RELATION_LABEL[v as Life['relation']]
    if (k === 'companion') {
      const c = v as NonNullable<Life['companion']>
      return `每年 ${c.meetPerYear} 次、每次 ${c.daysPerMeet} 天、算到 ${c.toAge} 岁；${c.livesTogether ? '住在一起' : '不同住'}`
    }
    if (typeof v === 'boolean') return v ? '开启' : '关闭'
    return String(v)
  }
  return LIFE_FIELDS.filter(([k]) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(([k, label]) => `${label}：本机 ${show(k, a[k])} / 备份 ${show(k, b[k])}`)
}

function datasetCount(d: Dataset) {
  return `${d.lives.length} 人、${d.entries.length} 条记录`
}

export function BackupPage() {
  const st = useAppState()
  const [snaps, setSnaps] = useState<Snapshot[]>([])
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [mode, setMode] = useState<ImportMode>('keep-local')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [restore, setRestore] = useState<Snapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)

  const refreshSnaps = () => void listSnapshots().then(setSnaps, () => setSnaps([]))
  useEffect(() => {
    if (st.ready && !st.error) refreshSnaps()
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [st.ready, st.lastWriteAt])

  let total = 0
  for (const m of st.entries.values()) total += m.size
  const names = new Map(st.lives.map((l) => [l.id, l.name]))
  const inWeChat = /MicroMessenger/i.test(navigator.userAgent)

  const doExport = async () => {
    if (exporting) return
    setExporting(true)
    setErr('')
    setMsg('')
    try {
      let file
      try {
        file = await exportFile()
      } catch {
        setErr('未能读取完整本机存档，没有导出文件。请重试，或刷新页面后再试。')
        return
      }
      const json = JSON.stringify(file, null, 1)
      const check = validateBackup(JSON.parse(json), st.today)
      if (!check.ok || check.data.lives.length !== file.lives.length || check.data.entries.length !== file.entries.length) {
        setErr('导出的文件没有通过自检，请刷新后再试。')
        return
      }
      const name = backupFileName(st.today)
      const blob = new File([json], name, { type: 'application/json' })
      const coarse = matchMedia('(pointer: coarse)').matches
      try {
        if (coarse && navigator.canShare?.({ files: [blob] })) {
          await navigator.share({ files: [blob], title: name })
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = name
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => URL.revokeObjectURL(url), 10_000)
        }
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') setErr('导出没有完成。可以重试或换个浏览器再试。')
        return
      }
      setMsg(`已导出并自检通过：${datasetCount(file)}。文件名 ${name}。请确认文件已保存或分享。`)
      try {
        await markBackedUp(new Date(file.exportedAt).getTime())
      } catch {
        setErr('备份文件已交付，但上次导出时间未能更新。请保管刚才的文件；页面的导出时间仍是原值。')
      }
    } finally {
      setExporting(false)
    }
  }

  const onFile = async (input: HTMLInputElement) => {
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    setErr('')
    setMsg('')
    if (f.size > MAX_BACKUP_BYTES) {
      setErr('文件太大了，不像是这个应用导出的备份。')
      return
    }
    let raw: unknown
    try {
      raw = JSON.parse(await f.text())
    } catch {
      setErr('这个文件不是有效的 JSON，没有导入任何内容。')
      return
    }
    const res = validateBackup(raw, st.today)
    if (!res.ok) {
      setErr(`${res.error}。没有导入任何内容。`)
      return
    }
    const exportedAt = typeof (raw as { exportedAt?: unknown }).exportedAt === 'string' ? (raw as { exportedAt: string }).exportedAt : undefined
    setMode('keep-local')
    const preview = await planImport(res.data)
    setPending({ name: f.name, data: res.data, warnings: res.warnings, exportedAt, ...preview })
  }

  const doImport = async () => {
    if (!pending) return
    setErr('')
    setMsg('')
    setBusy(true)
    try {
      const result = await applyImport(pending.data, pending.local, mode)
      if (result.status === 'review') {
        setPending({ ...pending, local: result.local, plan: result.plan, changed: true })
        setMode('keep-local')
        setConfirmReplace(false)
        return
      }
      const p = result.plan
      setMsg(
        mode === 'replace'
          ? `已替换为备份内容：${datasetCount(pending.data)}。导入前的数据已自动存为快照。`
          : `已合并：新增 ${p.lives.added.length} 人、${p.entries.added.length} 条记录；${p.lives.conflicts.length + p.entries.conflicts.length} 处冲突${mode === 'keep-local' ? '保留了本机' : '用了备份'}。导入前的数据已自动存为快照。`,
      )
      setPending(null)
      setConfirmReplace(false)
      refreshSnaps()
    } catch {
      setErr('导入失败，本机数据没有改变。')
    } finally {
      setBusy(false)
    }
  }

  const p = pending?.plan
  const nothingNew = p && p.lives.added.length + p.entries.added.length + p.lives.conflicts.length + p.entries.conflicts.length === 0

  return (
    <div class="page archive-page">
      <header class="archive-head">
        <h1>备份</h1>
        <p class="sub">所有内容只存在这台设备的这个浏览器里。换手机、清理浏览器之前，请先导出。</p>
      </header>

      {inWeChat && <div class="archive-notice warn">你正在微信里打开。微信内置浏览器可能清理本地数据，也可能无法下载文件。建议点右上角，用系统浏览器打开。</div>}
      {st.error && <div class="archive-notice warn" role="alert">{st.error}</div>}

      <section class="archive-section" aria-labelledby="archive-transfer-title">
        <h2 class="archive-title" id="archive-transfer-title"><span class="archive-number">01 /</span> 导出与导入</h2>
        <p>
          本机现在有 <b>{st.lives.length}</b> 人、<b>{total}</b> 条周记录。
        </p>
        <p class="muted small">
          上次导出：{st.lastBackupAt ? fmtTime(st.lastBackupAt) : '从未'}
          {persisted !== null && ` · 浏览器${persisted ? '已允许长期保存' : '可能会在空间不足时清理数据'}`}
        </p>
        <div class="archive-actions">
          <button type="button" class="btn primary block" onClick={doExport} disabled={!st.ready || !!st.error || exporting}>
            导出完整备份（JSON）
          </button>
          <label class="btn block file-btn">
            从备份导入…
            <input type="file" accept=".json,application/json" onChange={(e) => onFile(e.target as HTMLInputElement)} disabled={!st.ready || !!st.error} />
          </label>
        </div>
        <p class="muted small">导入前会先检查文件，并告诉你有哪些新增、哪些冲突。默认不会覆盖本机已有的记录。</p>
      </section>

      {msg && <div class="archive-notice ok" role="status">{msg}</div>}
      {err && <div class="archive-notice warn" role="alert">{err}</div>}

      <section class="archive-section" aria-labelledby="archive-snapshots-title">
        <h2 class="archive-title" id="archive-snapshots-title"><span class="archive-number">02 /</span> 本机快照</h2>
        <p class="muted small">每次导入或恢复之前，会自动在本机存一份快照，最多保留 3 份。它和你的数据在同一个浏览器里，不能代替导出。</p>
        {snaps.length === 0 ? (
          <p class="muted small">还没有快照。</p>
        ) : (
          <ul class="snaps">
            {snaps.map((s) => (
              <li key={s.id}>
                <span>
                  {fmtTime(s.createdAt)} · {s.reason}
                  <br />
                  <span class="muted small">{datasetCount(s.data)}</span>
                </span>
                <button type="button" class="btn small" onClick={() => setRestore(s)}>
                  恢复
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section class="archive-section archive-custody" aria-labelledby="archive-custody-title">
        <h2 class="archive-title" id="archive-custody-title">保管说明</h2>
        <p class="muted small">没有账号，没有服务器，没有统计。备份文件是明文 JSON，里面有你写下的每一句话，请像对待日记一样保管它。</p>
      </section>

      {pending && p && !confirmReplace && (
        <Modal title="导入前检查" onClose={() => !busy && setPending(null)} wide>
          {pending.changed && <p class="warn" role="alert">本机数据在预览后发生了变化，尚未导入。下面已按最新数据重新检查，请确认新的冲突和导入方式。</p>}
          <p class="archive-file-summary">
            {pending.name}
            {pending.exportedAt && <span class="muted">（导出于 {fmtTime(pending.exportedAt)}）</span>}
            ：{datasetCount(pending.data)}
          </p>
          <ul class="plan">
            <li>新增：{p.lives.added.length} 人、{p.entries.added.length} 条记录</li>
            <li>和本机完全相同：{p.lives.same.length} 人、{p.entries.same.length} 条记录</li>
            <li class={p.lives.conflicts.length + p.entries.conflicts.length ? 'hl' : ''}>
              冲突（同一个人或同一周，内容不同）：{p.lives.conflicts.length} 人、{p.entries.conflicts.length} 条记录
            </li>
          </ul>
          {(p.lives.conflicts.length > 0 || p.entries.conflicts.length > 0) && (
            <details class="conflicts" open>
              <summary>查看冲突</summary>
              <ul>
                {p.lives.conflicts.slice(0, 20).map((c) => (
                  <li key={c.local.id}>
                    <b class="archive-person-name">{c.local.name}</b>
                    {lifeDiff(c.local, c.incoming).map((d) => (
                      <div class="muted small" key={d}>
                        {d}
                      </div>
                    ))}
                  </li>
                ))}
                {p.entries.conflicts.slice(0, 30).map((c) => (
                  <li key={c.local.lifeId + c.local.week}>
                    <b class="archive-person-name">{names.get(c.local.lifeId) ?? '?'}</b> · {formatWeekRange(weekIdOf(c.local.week))}
                    <div class="small archive-entry-summary">本机：{entrySummary(c.local)}</div>
                    <div class="small archive-entry-summary">备份：{entrySummary(c.incoming)}</div>
                  </li>
                ))}
                {p.entries.conflicts.length > 30 && <li class="muted small">……还有 {p.entries.conflicts.length - 30} 条</li>}
              </ul>
            </details>
          )}
          {[...pending.warnings, ...p.warnings].length > 0 && (
            <ul class="warnings">
              {[...pending.warnings, ...p.warnings].map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {nothingNew ? (
            <p class="muted">备份里的内容，本机都已经有了，不需要导入。</p>
          ) : null}
          <fieldset class="modes">
            <legend>怎么导入</legend>
            <label class="check">
              <input type="radio" name="mode" checked={mode === 'keep-local'} onChange={() => setMode('keep-local')} />
              合并，冲突时保留本机（推荐）
            </label>
            <label class="check">
              <input type="radio" name="mode" checked={mode === 'overwrite-conflicts'} onChange={() => setMode('overwrite-conflicts')} />
              合并，冲突时用备份里的
            </label>
            <label class="check">
              <input type="radio" name="mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              完全替换为备份（本机不在备份里的内容会被移除）
            </label>
          </fieldset>
          <div class="row-btns">
            <button type="button" class="btn" onClick={() => setPending(null)}>
              取消
            </button>
            <button
              type="button"
              class={`btn ${mode === 'replace' ? 'danger' : 'primary'}`}
              disabled={busy || (!!nothingNew && mode !== 'replace')}
              onClick={() => (mode === 'replace' ? setConfirmReplace(true) : doImport())}
            >
              导入
            </button>
          </div>
        </Modal>
      )}

      {pending && confirmReplace && (
        <Confirm
          title="完全替换本机数据？"
          danger
          confirmText="替换"
          message={
            <p>
              本机现有的 {st.lives.length} 人、{total} 条记录将被替换为备份里的 {datasetCount(pending.data)}。替换前会自动存一份快照，可以在本页恢复。
            </p>
          }
          onCancel={() => setConfirmReplace(false)}
          onConfirm={doImport}
        />
      )}

      {restore && (
        <Confirm
          title="恢复这份快照？"
          confirmText="恢复"
          message={
            <p>
              本机数据将回到 {fmtTime(restore.createdAt)} 的样子（{datasetCount(restore.data)}）。恢复前会先把现在的数据存为一份新快照。
            </p>
          }
          onCancel={() => setRestore(null)}
          onConfirm={async () => {
            const s = restore
            setRestore(null)
            setErr('')
            setMsg('')
            try {
              await restoreSnapshot(s)
              setMsg(`已恢复到 ${fmtTime(s.createdAt)} 的快照。`)
              refreshSnaps()
            } catch {
              setErr('恢复失败，本机数据没有改变。')
            }
          }}
        />
      )}
      <TabBar active="backup" />
    </div>
  )
}
