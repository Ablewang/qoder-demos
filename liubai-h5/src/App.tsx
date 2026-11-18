import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { dishById, kindLabel } from './dishes'
import { buildHandOverMessage, choreList, dinnerCandidates, dinnerStyles, emptyData, entryFor, hours, localDay, mealAt, mealOf, mealSlots, mealTimes, moods, parseFoodShare, parseStoredData, recordMeal, restSlots, shoppingList, STORAGE_KEY, suggestHandOver, weeklyLoad } from './model'
import type { Chore, DinnerStyle, Doer, LedgerEntry, MealRecord, MealTime, StoredData } from './model'

type Page = 'today' | 'dinner' | 'ledger' | 'journal'
type SheetKind = 'breath' | 'privacy' | 'clear' | 'help' | 'food-save' | 'food-remove' | null
type CopyState = { target: 'shop' | 'message'; ok: boolean } | null
type Plan = { lists: string[][]; index: number[] }

const cnDigits = '零一二三四五六七八九'
const nextDoer: Record<Doer, Doer> = { 我: '他', 他: '一起', 一起: '我' }

function cnNumber(value: number): string {
  if (value < 10) return cnDigits[value]
  if (value === 10) return '十'
  if (value < 20) return `十${cnDigits[value % 10]}`
  return `${cnDigits[Math.floor(value / 10)]}十${value % 10 ? cnDigits[value % 10] : ''}`
}
function cnDate(date: Date): string { return `${cnNumber(date.getMonth() + 1)}月${cnNumber(date.getDate())}日` }
function cnWeekday(date: Date): string { return `星期${'日一二三四五六'[date.getDay()]}` }

function loadData() {
  try { return { data: parseStoredData(localStorage.getItem(STORAGE_KEY)), available: true } }
  catch { return { data: { ...emptyData }, available: false } }
}

function Seal({ children, tone = 'solid', className = '' }: { children: ReactNode; tone?: 'solid' | 'line'; className?: string }) {
  return <span className={`seal seal-${tone} ${className}`} aria-hidden="true">{children}</span>
}

function Sheet({ title, onClose, children, full = false }: { title: string; onClose: () => void; children: ReactNode; full?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-sheet-focus]')?.focus()
    return () => dialog.close()
  }, [])
  return <dialog ref={ref} className={`sheet ${full ? 'sheet-full' : ''}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="sheet-top"><span className="sheet-title">{title}</span><button autoFocus className="close-button" aria-label="关闭弹窗" onClick={onClose}>关闭</button></div>
    {children}
  </dialog>
}

function Breath({ onClose }: { onClose: () => void }) {
  const total = 60
  const [remaining, setRemaining] = useState(total)
  const [deadline, setDeadline] = useState<number | null>(() => Date.now() + total * 1000)
  useEffect(() => {
    if (deadline === null) return
    const tick = () => {
      const left = Math.max(0, (deadline - Date.now()) / 1000)
      setRemaining(left)
      if (left === 0) setDeadline(null)
    }
    tick()
    const interval = window.setInterval(tick, 100)
    return () => window.clearInterval(interval)
  }, [deadline])
  const done = remaining === 0
  const running = deadline !== null && !done
  const inhale = (total - remaining) % 10 < 4
  const shown = Math.ceil(remaining)
  const circumference = 2 * Math.PI * 92
  function toggle() {
    if (deadline !== null) { setRemaining(Math.max(0, (deadline - Date.now()) / 1000)); setDeadline(null) }
    else setDeadline(Date.now() + remaining * 1000)
  }
  return <div className="breath">
    <div className={`breath-stage ${running ? 'is-running' : ''} ${inhale ? 'is-in' : 'is-out'}`}>
      <svg viewBox="0 0 200 200" aria-hidden="true"><circle className="breath-track" cx="100" cy="100" r="92" /><circle className="breath-progress" cx="100" cy="100" r="92" strokeDasharray={circumference} strokeDashoffset={circumference * remaining / total} /></svg>
      <span className="breath-wash" aria-hidden="true" />
      <span className="breath-word" aria-hidden="true">{done ? '好' : !running ? '停' : inhale ? '吸' : '呼'}</span>
    </div>
    <p className="breath-hint" aria-live="polite">{done ? '一分钟到了。回去之前，肩膀再放松一点。' : !running ? '停在这里了，想继续就点继续。' : inhale ? '慢慢吸气' : '慢慢呼气，长一点'}</p>
    <p className="breath-time">还剩 <span>{`0:${String(shown).padStart(2, '0')}`}</span></p>
    <div className="breath-actions">
      {done ? <button className="primary-button" onClick={onClose}>回去</button> : <button className="primary-button" onClick={toggle}>{running ? '暂停' : '继续'}</button>}
      {!running && <button className="text-button" onClick={() => { setRemaining(total); setDeadline(Date.now() + total * 1000) }}>{done ? '再来一分钟' : '从头开始'}</button>}
    </div>
    <p className="fine">不用刻意深吸，不屏气。不舒服就停下，照平常呼吸。</p>
  </div>
}

function PageHead({ no, title, children }: { no: string; title: string; children: ReactNode }) {
  return <header className="page-head"><span className="page-no" aria-hidden="true">{no}</span><div><h1>{title}</h1><div className="page-sub">{children}</div></div></header>
}

export default function App() {
  const [initial] = useState(loadData)
  const [data, setData] = useState<StoredData>(initial.data)
  const [storageAvailable, setStorageAvailable] = useState(initial.available)
  const [page, setPage] = useState<Page>('today')
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [toast, setToast] = useState('')
  const [copy, setCopy] = useState<CopyState>(null)
  const today = new Date()
  const day = localDay(today)
  const [mealTime, setMealTime] = useState<MealTime>(() => mealAt(new Date()))
  const when = mealTimes.find(item => item.id === mealTime)!.when
  const todayMeal = data.meals.find(meal => meal.day === day && mealOf(meal) === mealTime)

  const [plan, setPlan] = useState<Plan | null>(null)
  const [editingMeal, setEditingMeal] = useState(false)
  const [have, setHave] = useState<string[]>([])
  const [showFoods, setShowFoods] = useState(false)
  const [shareText, setShareText] = useState('')
  const [shareError, setShareError] = useState('')
  const [removeFoodId, setRemoveFoodId] = useState<string | null>(null)
  const shareRef = useRef<HTMLTextAreaElement>(null)
  const todayFood = data.savedFoods.find(food => food.id === todayMeal?.shareId)

  const [customTitle, setCustomTitle] = useState('')
  const [draft, setDraft] = useState<string | null>(null)

  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const list = useMemo(() => choreList(data.tasks), [data.tasks])
  const load = weeklyLoad(list, data.ledger, data.tasks)
  const handOver = list.filter(chore => { const entry = entryFor(chore.id, data.ledger, data.tasks); return entry.handOver && entry.doer !== '他' })
  const slot = restSlots.find(item => item.id === data.restSlot)
  const message = draft ?? buildHandOverMessage(load, handOver, slot?.phrase ?? '')
  const ledgerTouched = data.ledger.length > 0 || data.tasks.length > 0 || !!data.restSlot
  const share = load.me + load.him ? load.me / (load.me + load.him) : 1

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toast])
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (note.trim()) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [note])

  function persist(next: StoredData) {
    setData(next)
    if (!storageAvailable) return false
    try {
      if (Object.values(next).every(value => value.length === 0)) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return true
    } catch { setStorageAvailable(false); return false }
  }
  function makePlan(source: StoredData, meal = mealTime): Plan {
    const lists = mealSlots(meal, source.dinnerStyle).map(slot => dinnerCandidates(slot.kind, source.meals, source.skipDishes, day, slot.quick))
    return { lists, index: lists.map(() => 0) }
  }
  function mealEntry(fields: { dishIds: string[]; shareId?: string }): MealRecord {
    return mealTime === 'dinner' ? { day, ...fields } : { day, ...fields, meal: mealTime }
  }
  function go(next: Page) {
    setPage(next); setCopy(null); window.scrollTo(0, 0)
    if (next === 'dinner') {
      if (!plan) setPlan(makePlan(data))
      if (todayFood) setShowFoods(true)
    }
  }
  function writeNow() { go('journal'); window.setTimeout(() => noteRef.current?.focus(), 60) }

  function saveFood() {
    const text = shareText
    const url = parseFoodShare(text)
    if (!url) { setShareError('没找到可打开的网页链接，请粘贴完整分享内容。'); shareRef.current?.focus(); return }
    if (data.savedFoods.some(food => food.url === url)) {
      setShareError(''); setSheet(null); setShowFoods(true); setShareText(''); setToast('已经收藏过了，不用再存。'); return
    }
    const saved = persist({ ...data, savedFoods: [{ id: crypto.randomUUID(), text, url, date: new Date().toISOString() }, ...data.savedFoods] })
    setShareText(''); setShareError(''); setSheet(null); setShowFoods(true)
    setToast(saved ? '收藏好了，只在这台手机上' : '暂存在这一页，关掉前请保留原分享')
  }
  function chooseFood(id: string) {
    persist({ ...data, meals: recordMeal(data.meals, mealEntry({ dishIds: [], shareId: id })) })
    setEditingMeal(false); setShowFoods(true); setCopy(null)
  }
  function removeFood() {
    const removed = persist({ ...data, savedFoods: data.savedFoods.filter(food => food.id !== removeFoodId), meals: data.meals.filter(meal => meal.shareId !== removeFoodId) })
    setRemoveFoodId(null); setSheet(null); setToast(removed ? '已移除收藏' : '只从这一页移除了，原有本机收藏未改动')
  }

  const showingMeal = !!todayMeal && !todayFood && !editingMeal
  const planIds = plan ? plan.lists.map((items, slotIndex) => items[plan.index[slotIndex]]).filter(Boolean) : []
  const mealIds = showingMeal ? todayMeal.dishIds : planIds
  const groceries = shoppingList(mealIds)
  const toBuy = groceries.filter(item => !have.includes(item))

  function switchMeal(next: MealTime) {
    if (next === mealTime) return
    const chosen = data.meals.find(meal => meal.day === day && mealOf(meal) === next)
    setMealTime(next); setPlan(makePlan(data, next)); setEditingMeal(false); setShowFoods(!!chosen?.shareId); setHave([]); setCopy(null)
  }
  function switchStyle(value: DinnerStyle) {
    const next = { ...data, dinnerStyle: value }
    persist(next); setPlan(makePlan(next)); setHave([]); setCopy(null)
  }
  function swap(slotIndex: number) {
    if (!plan) return
    setPlan({ ...plan, index: plan.index.map((value, index) => index === slotIndex ? (value + 1) % plan.lists[index].length : value) }); setCopy(null)
  }
  function swapAll() {
    if (!plan) return
    setPlan({ ...plan, index: plan.index.map((value, index) => (value + 1) % plan.lists[index].length) }); setCopy(null)
  }
  function skipDish(slotIndex: number) {
    if (!plan) return
    const id = planIds[slotIndex]
    const remaining = plan.lists[slotIndex].filter(item => item !== id)
    if (!remaining.length) { setToast('这一类只剩这一道了'); return }
    persist({ ...data, skipDishes: [...data.skipDishes, id] })
    setPlan({ lists: plan.lists.map((items, index) => index === slotIndex ? remaining : items), index: plan.index.map((value, index) => index === slotIndex ? value % remaining.length : value) })
    setCopy(null); setToast(`以后不再推荐${dishById.get(id)!.name}`)
  }
  function confirmMeal() { persist({ ...data, meals: recordMeal(data.meals, mealEntry({ dishIds: planIds })) }); setEditingMeal(false); setHave([]); setCopy(null) }
  async function copyText(target: 'shop' | 'message', text: string) {
    try { await navigator.clipboard.writeText(text); setCopy({ target, ok: true }) }
    catch { setCopy({ target, ok: false }) }
  }

  function setEntry(id: string, update: Partial<LedgerEntry>) {
    const current = entryFor(id, data.ledger, data.tasks)
    persist({ ...data, ledger: [...data.ledger.filter(entry => entry.id !== id), { ...current, ...update }] })
    setCopy(null)
  }
  function addCustom() {
    const title = customTitle.trim()
    setCustomTitle('')
    if (!title || list.some(chore => chore.title === title)) return
    persist({ ...data, tasks: [...data.tasks, { id: crypto.randomUUID(), title, owner: '我', when: '' }] })
  }
  function removeCustom(chore: Chore) {
    persist({ ...data, tasks: data.tasks.filter(task => task.id !== chore.id), ledger: data.ledger.filter(entry => entry.id !== chore.id) })
  }
  function pickForMe() {
    const ids = suggestHandOver(list, data.ledger, data.tasks)
    persist({ ...data, ledger: [...data.ledger.filter(entry => !ids.includes(entry.id)), ...ids.map(id => ({ ...entryFor(id, data.ledger, data.tasks), handOver: true }))] })
    setCopy(null)
  }

  function saveNote() {
    if (!note.trim()) { setNoteError(true); noteRef.current?.focus(); return }
    persist({ ...data, notes: [{ id: crypto.randomUUID(), text: note.trim(), tag: '心里话', date: new Date().toISOString() }, ...data.notes] })
    setNote(''); setNoteError(false); setToast(storageAvailable ? '留下了，只在这台手机上' : '暂存在这一页，关掉前记得导出')
  }
  function exportNotes() {
    const lines = [
      '留白 · 心里话', `导出于 ${new Date().toLocaleString('zh-CN')}`, '',
      ...data.notes.map(item => `${new Date(item.date).toLocaleString('zh-CN')}\n${item.text}\n`),
      ...[...data.checkIns].reverse().map(item => `${new Date(item.date).toLocaleString('zh-CN')} · ${moods.find(value => value.id === item.mood)?.label}`),
    ]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `留白-心里话-${day}.txt`; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast('已开始下载，留意浏览器的下载提示')
  }
  function clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY); setStorageAvailable(true)
      setData({ ...emptyData }); setNote(''); setDraft(null); setPlan(null); setEditingMeal(false); setHave([]); setShareText(''); setShareError(''); setRemoveFoodId(null); setShowFoods(false); setSheet(null); setToast('本机记录已全部清除')
    } catch { setToast('浏览器没有允许清除，记录还在') }
  }

  const hasJournal = data.notes.length > 0 || data.checkIns.length > 0
  const navItems: [Page, string][] = [['today', '今天'], ['dinner', '吃什么'], ['ledger', '家务账'], ['journal', '心里话']]
  const doerName = (doer: Doer) => doer === '一起' ? '一起' : doer

  return <>
    <header className="masthead">
      <button className="brand" onClick={() => go('today')} aria-label="留白，回到今天"><Seal className="brand-seal">留白</Seal></button>
      <p className="masthead-date"><span>{cnDate(today)}</span><small>{cnWeekday(today)}</small></p>
      <button className="text-button masthead-help" onClick={() => setSheet('help')}>撑不住时</button>
    </header>
    <main className={`main page-${page}`}>
      {!storageAvailable && <p className="notice" role="alert">这台设备暂时存不了记录，新写的内容只留在这一页，请及时导出；原有记录不会被覆盖。</p>}

      {page === 'today' && <>
        <h1 className="today-title">今天，先替你<br />省掉几件事。</h1>
        <nav aria-label="今天要用的" className="index">
          <button className="index-row" onClick={() => go('dinner')}><span className="index-no" aria-hidden="true">壹</span><span className="index-main"><strong>{when}吃什么</strong><span className={todayFood ? 'share-preview' : undefined}>{todayFood ? todayFood.text : todayMeal ? todayMeal.dishIds.map(id => dishById.get(id)!.name).join('、') : '替你定好菜，顺手列出要买的'}</span></span><span className="index-go">{todayFood ? '看原内容' : todayMeal ? '看清单' : '替我定'}</span></button>
          <button className="index-row" onClick={() => setSheet('breath')}><span className="index-no" aria-hidden="true">贰</span><span className="index-main"><strong>喘口气</strong><span>烦的时候按一下，一分钟</span></span><span className="index-go">开始</span></button>
          <button className="index-row" onClick={() => go('ledger')}><span className="index-no" aria-hidden="true">叁</span><span className="index-main"><strong>家务账</strong><span>{ledgerTouched ? `你每周约 ${hours(load.me)} 小时，他约 ${hours(load.him)} 小时` : '算清看不见的活，交几件给他'}</span></span><span className="index-go">{ledgerTouched ? '接着弄' : '去算'}</span></button>
          <button className="index-row" onClick={writeNow}><span className="index-no" aria-hidden="true">肆</span><span className="index-main"><strong>心里话</strong><span>{data.notes.length ? `已经留下 ${data.notes.length} 页` : '写两句，只存在这台手机'}</span></span><span className="index-go">写</span></button>
        </nav>
      </>}

      {page === 'dinner' && <>
        <PageHead no="壹" title={`${when}吃什么`}>
          <div className="meal-times" role="group" aria-label="哪一顿">{mealTimes.map(item => <button key={item.id} aria-pressed={mealTime === item.id} onClick={() => switchMeal(item.id)}>{item.label}</button>)}</div>
        </PageHead>
        <div className="food-tools">
          <button className="text-button" onClick={() => setShowFoods(!showFoods)}>{showFoods ? '看推荐菜单' : `想吃收藏夹 · ${data.savedFoods.length}`}</button>
          <button className="mini-button" onClick={() => { setShareError(''); setSheet('food-save') }}>粘贴想吃的</button>
        </div>
        {todayFood && !editingMeal && <section className="block chosen-food" aria-label={`${when}想吃的`}>
          <h2 className="block-title"><span>{when}想吃这个</span><Seal className="stamp small">定</Seal></h2>
          <p className="share-text share-preview">{todayFood.text}</p>
          <a className="secondary-button original-link" href={todayFood.url} target="_blank" rel="noopener noreferrer">打开原内容</a>
          <p className="fine">看原内容里的做法和食材，这里不自动生成买菜单。</p>
          <button className="text-button" onClick={() => { setEditingMeal(true); setShowFoods(false); if (!plan) setPlan(makePlan(data)) }}>还是替我挑菜</button>
        </section>}
        {showFoods && <section className="block" aria-label="想吃收藏夹">
          <h2 className="block-title"><span>想吃收藏夹</span><small>只存链接，不分析内容</small></h2>
          {!data.savedFoods.length ? <p className="block-note">刷到想吃的，复制分享内容，再点“粘贴想吃的”。不用整理菜谱。</p> : <ul className="saved-foods">
            {data.savedFoods.map(food => <li className="saved-food" key={food.id}>
              <p className="share-text share-preview">{food.text}</p>
              <span className="share-host">{new URL(food.url).hostname}</span>
              <div className="share-actions">
                <a className="mini-button original-link" href={food.url} target="_blank" rel="noopener noreferrer">打开原内容</a>
                <button className="mini-button quiet" disabled={todayFood?.id === food.id && !editingMeal} onClick={() => chooseFood(food.id)}>{todayFood?.id === food.id && !editingMeal ? `${when}已选` : `${when}吃这个`}</button>
              </div>
              <div className="share-bottom">
                <details className="share-original"><summary>分享原文</summary><p>{food.text}</p></details>
                <button className="text-button" aria-label="移除这条收藏" onClick={() => { setRemoveFoodId(food.id); setSheet('food-remove') }}>移除</button>
              </div>
            </li>)}
          </ul>}
          <p className="fine">点开会离开留白；原内容删除或需要登录时，可能打不开。</p>
        </section>}
        {!showFoods && (!todayFood || editingMeal) && (showingMeal ? <section className="block" aria-label={`${when}的菜`}>
          <ul className="menu-list">{todayMeal.dishIds.map(id => { const dish = dishById.get(id)!; return <li key={id} className="dish"><Seal tone="line" className={kindLabel[dish.kind].length > 1 ? 'dish-kind pair' : 'dish-kind'}>{kindLabel[dish.kind]}</Seal><span className="dish-name">{dish.name}<small>约 {dish.minutes} 分钟</small></span></li> })}</ul>
          <div className="settled"><Seal className="stamp">定</Seal><span>{when}就吃{todayMeal.dishIds.length > 1 ? '这些' : '这个'}。</span><button className="text-button" onClick={() => { setEditingMeal(true); setHave([]); setCopy(null); if (!plan) setPlan(makePlan(data)) }}>重新挑</button></div>
        </section> : plan && <section className="block" aria-label="替你挑的菜">
          {mealTime === 'dinner'
            ? <div className="switch styles" role="group" aria-label="今晚怎么吃">{dinnerStyles.map(item => <button key={item.id} aria-pressed={data.dinnerStyle === item.id} onClick={() => switchStyle(item.id)}>{item.label}</button>)}</div>
            : <p className="block-note meal-hint">{mealTime === 'lunch' ? '一个人吃，十分钟内能好。' : '早上赶时间，挑简单的。'}</p>}
          <ul className="menu-list">{planIds.map((id, slotIndex) => { const dish = dishById.get(id)!; return <li key={slotIndex} className="dish"><Seal tone="line" className={kindLabel[dish.kind].length > 1 ? 'dish-kind pair' : 'dish-kind'}>{kindLabel[dish.kind]}</Seal><span className="dish-name">{dish.name}<small>约 {dish.minutes} 分钟</small></span><span className="dish-actions"><button className="mini-button" onClick={() => swap(slotIndex)} aria-label={`换掉${dish.name}`}>换</button><button className="mini-button quiet" onClick={() => skipDish(slotIndex)} aria-label={`以后不吃，${dish.name}`}>不吃</button></span></li> })}</ul>
          <div className="menu-actions">
            <button className="primary-button" onClick={confirmMeal}>{planIds.length > 1 ? '就吃这些' : '就吃这个'}</button>
            {planIds.length > 1 && <button className="secondary-button" disabled={!plan.lists.some(items => items.length > 1)} onClick={swapAll}>全部换一换</button>}
          </div>
          <p className="fine">最近七天吃过的会往后放，少重样。</p>
        </section>)}
        {!showFoods && (!todayFood || editingMeal) && <section className="block" aria-labelledby="shop-title">
          <h2 id="shop-title" className="block-title"><span>要买的</span><small>家里有的，点一下划掉</small></h2>
          <ul className="shop-list">{groceries.map(item => { const got = have.includes(item); return <li key={item}><button aria-pressed={got} aria-label={`${item}${got ? '，家里有' : ''}`} onClick={() => { setHave(got ? have.filter(value => value !== item) : [...have, item]); setCopy(null) }}>{item}</button></li> })}</ul>
          <button className="secondary-button" disabled={!toBuy.length} onClick={() => copyText('shop', `买菜：${toBuy.join('、')}`)}>{!toBuy.length ? '家里都有，不用买' : copy?.target === 'shop' && copy.ok ? '已复制，可以发给他下班带' : `复制要买的 ${toBuy.length} 样`}</button>
          {copy?.target === 'shop' && !copy.ok && <p className="fine warn" role="status">没能自动复制，请手动记下。</p>}
        </section>}
        {!showFoods && (!todayFood || editingMeal) && data.skipDishes.length > 0 && <details className="fold"><summary>不吃的菜 · {data.skipDishes.length}</summary><ul className="restore-list">{data.skipDishes.map(id => <li key={id}><span>{dishById.get(id)!.name}</span><button className="text-button" onClick={() => persist({ ...data, skipDishes: data.skipDishes.filter(value => value !== id) })} aria-label={`恢复推荐${dishById.get(id)!.name}`}>恢复</button></li>)}</ul></details>}
      </>}

      {page === 'ledger' && <>
        <PageHead no="叁" title="家务账">先按全是你做来算，他做的在最下面改。</PageHead>
        <section className="tally" aria-label="每周大约用时" aria-live="polite">
          <div className="tally-nums">
            <p><span>你</span><strong>{hours(load.me)}</strong><small>小时／周</small></p>
            <p className="him"><span>他</span><strong>{hours(load.him)}</strong><small>小时／周</small></p>
          </div>
          <div className="tally-bar" aria-hidden="true"><span style={{ width: `${share * 100}%` }} /></div>
          <p className="tally-note">没人看得见、要一直记着的事，有 <b>{load.invisibleMine}</b> 件在你这里。时长按常见情况粗估。</p>
        </section>

        <section className="block" aria-labelledby="give-title">
          <h2 id="give-title" className="block-title"><span>交给他的</span><small>{handOver.length ? `${handOver.length} 件，从记得到做完都归他` : '从记得到做完，都归他'}</small></h2>
          {handOver.length > 0 && <ul className="give-list">{handOver.map(chore => <li key={chore.id}><Seal className="stamp small">交</Seal><span>{chore.title}<small>{chore.cadence}</small></span><button className="text-button" onClick={() => setEntry(chore.id, { handOver: false })} aria-label={`${chore.title}不交了`}>不交了</button></li>)}</ul>}
          {handOver.length ? <button className="text-button" onClick={pickForMe}>再按耗时挑 3 件</button> : <button className="secondary-button" onClick={pickForMe}>按耗时帮我挑 3 件</button>}
        </section>

        <section className="block" aria-labelledby="rest-title">
          <h2 id="rest-title" className="block-title"><span>留一段给自己</span><small>那段时间，家里交给他</small></h2>
          <div className="switch wrap" role="group" aria-label="留给自己的时间">{restSlots.map(item => <button key={item.id} aria-pressed={data.restSlot === item.id} onClick={() => { persist({ ...data, restSlot: data.restSlot === item.id ? '' : item.id }); setCopy(null) }}>{item.label}</button>)}</div>
        </section>

        <section className="block" aria-labelledby="msg-title">
          <h2 id="msg-title" className="block-title"><span>发给他的话</span><small>{draft === null ? '已按上面写好，可以改' : '你改过了，不再自动改'}</small></h2>
          <label className="sr-only" htmlFor="message">发给他的话</label>
          <textarea id="message" className="letter" value={message} maxLength={4000} onChange={event => { setDraft(event.target.value); setCopy(null) }} />
          {draft !== null && <button className="text-button" onClick={() => { setDraft(null); setCopy(null) }}>按上面的选择重写</button>}
          <button className="primary-button" disabled={!message.trim()} onClick={() => copyText('message', message)}>{copy?.target === 'message' && copy.ok ? '已复制，去微信粘贴' : '复制这段话'}</button>
          <p className="fine" role="status">{copy?.target === 'message' ? copy.ok ? '发不发、什么时候发，由你定。' : '没能自动复制，请长按上面的文字手动复制。' : '不会替你发送，也不会替他答应。'}</p>
        </section>

        <section className="block" aria-labelledby="who-title">
          <h2 id="who-title" className="block-title"><span>逐项核对</span><small>点“我”切换：我 → 他 → 同</small></h2>
          {(['每天', '每周', '要记着'] as const).map(group => <div key={group} className="chore-group">
            <h3>{group === '要记着' ? '要一直记着的' : group}</h3>
            <ul>{list.filter(chore => chore.group === group).map(chore => {
              const entry = entryFor(chore.id, data.ledger, data.tasks)
              const custom = data.tasks.some(task => task.id === chore.id)
              const given = entry.handOver && entry.doer !== '他'
              return <li key={chore.id} className={`chore ${given ? 'is-given' : ''}`}>
                <span className="chore-name">{chore.title}<small>{chore.cadence} · 约 {chore.minutes} 分钟</small></span>
                {custom && <button className="mini-button quiet" onClick={() => removeCustom(chore)} aria-label={`删去${chore.title}`}>删</button>}
                <button className={`doer doer-${entry.doer}`} onClick={() => setEntry(chore.id, { doer: nextDoer[entry.doer], handOver: nextDoer[entry.doer] === '他' ? false : entry.handOver })} aria-label={`${chore.title}：${doerName(entry.doer)}在做，点一下改成${doerName(nextDoer[entry.doer])}`}>{entry.doer === '一起' ? '同' : entry.doer}</button>
                <button className={`hand ${given ? 'on' : ''}`} disabled={entry.doer === '他'} aria-pressed={given} onClick={() => setEntry(chore.id, { handOver: !entry.handOver })} aria-label={`把${chore.title}交给他`}>交</button>
              </li>
            })}</ul>
          </div>)}
          <form className="inline-form" onSubmit={event => { event.preventDefault(); addCustom() }}><label className="sr-only" htmlFor="custom-chore">还有别的家务</label><input id="custom-chore" value={customTitle} maxLength={40} onChange={event => setCustomTitle(event.target.value)} placeholder="还有别的？写一件" /><button className="secondary-button" disabled={!customTitle.trim()}>加上</button></form>
        </section>
      </>}

      {page === 'journal' && <>
        <PageHead no="肆" title="心里话">写两句就好，点“留下这页”才保存。</PageHead>
        <section className="block" aria-label="写心里话">
          <label className="sr-only" htmlFor="note">写下心里话</label>
          <textarea id="note" ref={noteRef} className="letter ruled" value={note} maxLength={2000} aria-invalid={noteError} aria-describedby={noteError ? 'note-error' : undefined} onChange={event => { setNote(event.target.value); setNoteError(false) }} placeholder="今天最累的是……" />
          {noteError && <p id="note-error" className="fine warn" role="alert">先写一点，再留下。</p>}
          {note.length > 1800 && <p className="fine">还能写 {2000 - note.length} 字</p>}
          <button className="primary-button" onClick={saveNote}>留下这页</button>
        </section>
        <section className="block" aria-labelledby="past-title">
          <h2 id="past-title" className="block-title"><span>留下的</span>{hasJournal && <button className="text-button" onClick={exportNotes}>导出</button>}</h2>
          {!hasJournal ? <p className="block-note">还没有。不用每天写。</p> : <ol className="past">
            {data.notes.map(item => <li key={item.id}><time dateTime={item.date}>{cnDate(new Date(item.date))}</time><p>{item.text}</p></li>)}
            {[...data.checkIns].reverse().map(item => <li key={item.id} className="past-mood"><time dateTime={item.date}>{cnDate(new Date(item.date))}</time><p>那天{moods.find(value => value.id === item.mood)?.label}</p></li>)}
          </ol>}
        </section>
      </>}

      <footer className="colophon"><span>不登录 · 不上传 · 只存在这台手机</span><button className="text-button" onClick={() => setSheet('privacy')}>记录与清除</button></footer>
    </main>
    <nav className="tabs" aria-label="主导航">{navItems.map(([id, label]) => <button key={id} className={page === id ? 'active' : ''} aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>{label}</button>)}</nav>
    {toast && <div className="toast" role="status">{toast}</div>}

    {sheet && <Sheet full={sheet === 'breath'} title={sheet === 'breath' ? '喘口气' : sheet === 'help' ? '撑不住的时候' : sheet === 'clear' ? '确认清除' : sheet === 'food-save' ? '收藏想吃的' : sheet === 'food-remove' ? '移除收藏' : '记录与清除'} onClose={() => setSheet(null)}>
      {sheet === 'food-save' && <form className="sheet-body share-form" onSubmit={event => { event.preventDefault(); saveFood() }}>
        <h2>刷到想吃的，留在这里。</h2>
        <label htmlFor="share-content">分享内容</label>
        <textarea id="share-content" data-sheet-focus ref={shareRef} rows={4} maxLength={4000} value={shareText} onChange={event => { setShareText(event.target.value); setShareError('') }} aria-invalid={!!shareError} aria-describedby={shareError ? 'share-error' : 'share-hint'} placeholder="在抖音或小红书点分享、复制链接，把整段文字粘贴到这里。" />
        <p id="share-hint" className="fine">分享文字和网页链接都能存。只保存在本机，不读取视频。</p>
        {shareError && <p id="share-error" className="fine warn" role="alert">{shareError}</p>}
        <button className="primary-button" type="submit">保存收藏</button>
      </form>}
      {sheet === 'food-remove' && <div className="sheet-body">
        <h2>移除这条收藏？</h2>
        <p>只从留白移除，不会删除原平台的内容。若哪一顿选了它，也会一并取消。</p>
        <button className="danger-button" onClick={removeFood}>确认移除收藏</button>
        <button className="secondary-button" onClick={() => { setRemoveFoodId(null); setSheet(null) }}>保留收藏</button>
      </div>}
      {sheet === 'breath' && <Breath onClose={() => setSheet(null)} />}
      {sheet === 'help' && <div className="sheet-body">
        <h2>不必一个人扛。</h2>
        <p>留白只帮你省点事、喘口气，不是心理诊断或治疗，也替代不了身边的人。</p>
        <h3>一直很难受</h3><p>情绪、睡眠或日常已经受影响，就联系信得过的人，并去正规医院或找合格的心理专业人员，不用等到“够严重”。</p>
        <h3 className="urgent">此刻想伤害自己</h3><p>马上联系当地急救或紧急服务，或请人陪在身边，不要只靠这个页面。如果家里的沟通让你不安全，也请先找现实中的支持。</p>
        <button className="secondary-button" onClick={() => { setSheet(null); writeNow() }}>先写下来</button>
      </div>}
      {sheet === 'privacy' && <div className="sheet-body">
        <h2>都留在这台手机上。</h2>
        <ul className="plain-list"><li>不登录、不上传、不分析，也不会同步到别的设备。</li><li>清除浏览器数据、用无痕模式或换网址打开，记录可能找不回。</li><li>本机存储不是保险箱，共用手机时请留意。</li><li>心里话要点“留下这页”才保存；发给他的话不保存。</li><li>想吃收藏要点保存才留下，只存分享文字和链接；打开原链接后由原平台处理访问。</li></ul>
        <button className="secondary-button" disabled={!hasJournal} onClick={exportNotes}>导出心里话</button>
        <button className="text-button danger" onClick={() => setSheet('clear')}>清除本机全部记录</button>
      </div>}
      {sheet === 'clear' && <div className="sheet-body">
        <h2>真的全部清除？</h2>
        <p>心里话、家务账、想吃收藏、吃过和不吃的菜，以及正在写的字，都会删掉，找不回来。想留着，先取消去导出。</p>
        <button className="danger-button" onClick={clearAll}>确认清除全部记录</button>
        <button className="secondary-button" onClick={() => setSheet('privacy')}>取消，保留记录</button>
      </div>}
    </Sheet>}
  </>
}
