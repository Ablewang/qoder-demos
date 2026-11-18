import { useState } from 'preact/hooks'
import { DEFAULT_COMPANION } from '../lib/companion'
import { MIN_YEAR, ageOn, checkPastDate, toDay } from '../lib/date'
import {
  DEFAULT_DRAW_TO_AGE,
  DEFAULT_THEME,
  RELATIONS,
  RELATION_LABEL,
  THEMES,
  THEME_KEYS,
  newId,
  type Life,
  type Relation,
} from '../lib/model'
import { go } from '../router'
import { createLife, entryCount, removeLife, saveFailureMessage, saveLife, useAppState } from '../state/store'
import { Confirm, Stepper, TopBar } from '../ui/ui'

const BIRTH_LABEL: Record<Relation, string> = {
  self: '你的生日',
  child: '出生日期',
  partner: 'TA 的生日',
  parent: 'TA 的生日',
  pet: '出生（或到家）日期',
  other: 'TA 的生日',
}

export function PersonForm(props: { id?: string; rel?: string }) {
  const st = useAppState()
  const { today, lives } = st
  const existing = props.id ? lives.find((l) => l.id === props.id) : undefined
  const selfTaken = lives.some((l) => l.relation === 'self' && l.id !== existing?.id)
  const initialRel: Relation = existing?.relation ?? (RELATIONS.includes(props.rel as Relation) && !(props.rel === 'self' && selfTaken) ? (props.rel as Relation) : selfTaken ? 'child' : 'self')

  const [rel, setRel] = useState<Relation>(initialRel)
  const [name, setName] = useState(existing?.name ?? (initialRel === 'self' ? '我' : ''))
  const [birth, setBirth] = useState(existing?.birthDate ?? '')
  const [color, setColor] = useState(existing?.color ?? DEFAULT_THEME[initialRel])
  const [colorTouched, setColorTouched] = useState(!!existing)
  const [drawToAge, setDrawToAge] = useState(existing?.drawToAge ?? DEFAULT_DRAW_TO_AGE[initialRel])
  const [showFuture, setShowFuture] = useState(existing?.showFuture ?? true)
  const [metDate, setMetDate] = useState(existing?.metDate ?? '')
  const [gone, setGone] = useState(!!existing?.endDate)
  const [endDate, setEndDate] = useState(existing?.endDate ?? '')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [askDelete, setAskDelete] = useState(false)
  const [saveError, setSaveError] = useState('')

  if (props.id && st.ready && !existing) {
    return (
      <div class="page">
        <TopBar title="找不到这个人" backTo="/" />
        <p class="muted pad">TA 可能已经被删除了。</p>
        {saveError && <div class="error" role="alert">{saveError}</div>}
      </div>
    )
  }

  const pickRel = (r: Relation) => {
    setRel(r)
    if (!colorTouched) setColor(DEFAULT_THEME[r])
    if (!existing) setDrawToAge(DEFAULT_DRAW_TO_AGE[r])
    if (!existing && r === 'self' && !name) setName('我')
    if (!existing && r !== 'self' && name === '我') setName('')
  }

  const errors: Record<string, string> = {}
  if (!name.trim()) errors.name = '请填写一个称呼'
  const b = checkPastDate(birth, today, '日期')
  if (!b.ok) errors.birth = b.reason
  if (rel === 'partner' && metDate) {
    const m = checkPastDate(metDate, today, '相识日期')
    if (!m.ok) errors.met = m.reason
    else if (b.ok && toDay(metDate) < toDay(birth)) errors.met = '相识日期不能早于 TA 的生日'
  }
  const allowGone = rel !== 'self'
  if (allowGone && gone) {
    const e = checkPastDate(endDate, today, '离开的日期')
    if (!e.ok) errors.end = e.reason
    else if (b.ok && toDay(endDate) < toDay(birth)) errors.end = '离开的日期不能早于出生日期'
  }
  const valid = Object.keys(errors).length === 0
  const futureAllowed = rel !== 'child' && !(allowGone && gone)
  const minDrawAge = b.ok ? Math.min(120, ageOn(birth, today) + 1) : 1

  const submit = async (e: Event) => {
    e.preventDefault()
    setTried(true)
    if (!valid || busy) return
    setBusy(true)
    const now = Date.now()
    const life: Life = {
      ...(existing ?? { id: newId(), createdAt: now, order: Math.max(0, ...lives.map((l) => l.order + 1)), updatedAt: now }),
      name: name.trim().slice(0, 40),
      relation: rel,
      birthDate: birth,
      color,
      drawToAge: Math.max(drawToAge, 1),
      showFuture: rel === 'child' ? false : showFuture,
      updatedAt: now,
    }
    if (rel === 'partner' && metDate) life.metDate = metDate
    else delete life.metDate
    if (allowGone && gone) life.endDate = endDate
    else delete life.endDate
    if (rel !== 'parent') {
      delete life.companionOn
    } else if (!life.companion) {
      life.companion = { ...DEFAULT_COMPANION }
    }
    try {
      if (props.id) await saveLife(life)
      else await createLife(life)
      go(`/life/${life.id}`)
    } catch (err) {
      setSaveError(saveFailureMessage(err))
      setBusy(false)
    }
  }

  return (
    <div class="page">
      <TopBar title={existing ? `编辑 · ${existing.name}` : '添加一个人'} backTo={existing ? `/life/${existing.id}` : '/'} />
      <form class="form person-form" onSubmit={submit} noValidate>
        <p class="form-intro">先留下称呼和生日，时间页从出生那周展开。</p>
        <fieldset class="relation-field">
          <legend>这页属于</legend>
          <div class="relation-options">
            {RELATIONS.map((r) => (
              <button
                type="button"
                key={r}
                class={`relation-option${rel === r ? ' on' : ''}`}
                aria-pressed={rel === r}
                disabled={r === 'self' && selfTaken}
                title={r === 'self' && selfTaken ? '已经有「我」了' : undefined}
                onClick={() => pickRel(r)}
              >
                {RELATION_LABEL[r]}
              </button>
            ))}
          </div>
        </fieldset>

        <div class="person-identity-fields">
          <label class="field name-field">
            <span>称呼</span>
            <input type="text" aria-label="称呼" maxLength={40} value={name} placeholder={rel === 'parent' ? '比如：妈妈' : rel === 'child' ? '比如：小满' : '名字或称呼'} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            {tried && errors.name && <div class="error">{errors.name}</div>}
          </label>

          <label class="field birth-field">
            <span>{BIRTH_LABEL[rel]}</span>
            <input type="date" min={`${MIN_YEAR}-01-01`} max={today} value={birth} onInput={(e) => setBirth((e.target as HTMLInputElement).value)} />
            {(birth || tried) && errors.birth && <div class="error">{errors.birth}</div>}
            {rel === 'child' && <div class="hint">孩子的时间轴只画到这一周，不画未来。还没出生的宝宝暂时不支持。</div>}
          </label>
        </div>

        {rel === 'partner' && (
          <label class="field">
            <span>你们相识的日子（可不填）</span>
            <input type="date" min={birth || `${MIN_YEAR}-01-01`} max={today} value={metDate} onInput={(e) => setMetDate((e.target as HTMLInputElement).value)} />
            {metDate && errors.met && <div class="error">{errors.met}</div>}
            <div class="hint">从这一周起，TA 的格子会染上你们的颜色。</div>
          </label>
        )}

        <details class="field signature-color">
          <summary>
            <span>署名颜色</span>
            <span class="settings-summary">
              <span class="color-circle" style={{ background: THEMES[color].hex }} aria-hidden="true" />
              {THEMES[color].name}
            </span>
          </summary>
          <div class="color-options" role="group" aria-label="署名颜色">
            {THEME_KEYS.map((k) => (
              <button
                type="button"
                key={k}
                class={`color-option${color === k ? ' on' : ''}`}
                aria-pressed={color === k}
                onClick={() => {
                  setColor(k)
                  setColorTouched(true)
                }}
              >
                <span class="color-circle" style={{ background: THEMES[k].hex }} aria-hidden="true" />
                <span>{THEMES[k].name}</span>
              </button>
            ))}
          </div>
        </details>

        {allowGone && (
          <div class="field">
            <label class="check">
              <input type="checkbox" checked={gone} onChange={(e) => setGone((e.target as HTMLInputElement).checked)} />
              TA 已经离开了
            </label>
            {gone && (
              <>
                <input type="date" aria-label="离开的日期" min={birth || `${MIN_YEAR}-01-01`} max={today} value={endDate} onInput={(e) => setEndDate((e.target as HTMLInputElement).value)} />
                {(tried || endDate) && errors.end && <div class="error">{errors.end}</div>}
                <div class="hint">格子会停在那一周。之后仍可以给过去的周补写回忆。</div>
              </>
            )}
          </div>
        )}

        {futureAllowed && (
          <>
            <details class="field more future-settings" open={!!existing && (!showFuture || drawToAge !== DEFAULT_DRAW_TO_AGE[rel])}>
              <summary>
                <span>未来的时间轴</span>
                <span class="settings-summary">{showFuture ? `画到 ${drawToAge} 岁` : '不显示未来'}</span>
              </summary>
              <label class="check">
                <input type="checkbox" checked={showFuture} onChange={(e) => setShowFuture((e.target as HTMLInputElement).checked)} />
                显示未来的空白周
              </label>
              {showFuture && (
                <Stepper label="时间轴画到多少岁" value={drawToAge} min={Math.max(1, minDrawAge)} max={120} unit="岁" onChange={setDrawToAge} />
              )}
            </details>
            <p class="hint future-explanation">默认画到 {DEFAULT_DRAW_TO_AGE[rel]} 岁，可在这里修改。这只是时间轴的绘制范围，不是寿命预测。</p>
          </>
        )}

        {saveError && <div class="error" role="alert">{saveError}</div>}
        {tried && !valid && <div class="error">还有需要填写或修改的地方</div>}
        <button type="submit" class="btn primary block" disabled={busy}>
          {existing ? '保存' : '创建'}
        </button>
        {existing && (
          <button type="button" class="btn danger-ghost block" onClick={() => setAskDelete(true)}>
            删除这个人
          </button>
        )}
      </form>

      {askDelete && existing && (
        <Confirm
          title={`删除「${existing.name}」？`}
          danger
          confirmText="删除"
          message={
            <>
              <p>
                将删除 TA 的格子和 <b>{entryCount(existing.id)}</b> 条周记录。其他人的格子和记录不受影响。
              </p>
              <p>删除后无法撤销。如果还想留着，建议先去「备份」导出一份。</p>
            </>
          }
          onCancel={() => setAskDelete(false)}
          onConfirm={async () => {
            setAskDelete(false)
            try {
              await removeLife(existing.id)
              go('/')
            } catch (err) {
              setSaveError(saveFailureMessage(err))
            }
          }}
        />
      )}
    </div>
  )
}
