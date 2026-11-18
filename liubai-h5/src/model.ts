import { dishById, dishes } from './dishes'
import type { DishKind } from './dishes'

export type MoodId = 'tired' | 'restless' | 'lonely' | 'okay'
export type Owner = '待商量' | '伴侣' | '我' | '一起'
export type Doer = '我' | '他' | '一起'
export interface CheckIn { id: string; mood: MoodId; date: string }
export interface Note { id: string; text: string; tag: string; date: string }
export interface HouseholdTask { id: string; title: string; owner: Owner; when: string }
export interface LedgerEntry { id: string; doer: Doer; handOver: boolean }
export interface SavedFood { id: string; text: string; url: string; date: string }
export type MealTime = 'breakfast' | 'lunch' | 'dinner'
export type DinnerStyle = '' | 'two' | 'easy' | 'one'
export interface MealRecord { day: string; dishIds: string[]; shareId?: string; meal?: 'breakfast' | 'lunch' }
export interface StoredData {
  checkIns: CheckIn[]; notes: Note[]; tasks: HouseholdTask[]; savedIds: string[]
  ledger: LedgerEntry[]; meals: MealRecord[]; skipDishes: string[]; restSlot: string; savedFoods: SavedFood[]
  dinnerStyle: DinnerStyle
}
export interface Chore { id: string; title: string; group: '每天' | '每周' | '要记着'; cadence: string; perWeek: number; minutes: number; invisible: boolean }

export const STORAGE_KEY = 'liubai-private-v1'
export const emptyData: StoredData = { checkIns: [], notes: [], tasks: [], savedIds: [], ledger: [], meals: [], skipDishes: [], restSlot: '', savedFoods: [], dinnerStyle: '' }
export const moods: { id: MoodId; label: string }[] = [
  { id: 'tired', label: '有点累' }, { id: 'restless', label: '有点烦' }, { id: 'lonely', label: '空落落' }, { id: 'okay', label: '还不错' },
]
const legacyActivityIds = ['tea', 'song', 'window', 'walk', 'draw', 'read', 'library', 'friend', 'ask']

export const chores: Chore[] = [
  { id: 'breakfast', title: '做早饭', group: '每天', cadence: '每天', perWeek: 7, minutes: 25, invisible: false },
  { id: 'dropoff', title: '送孩子上学', group: '每天', cadence: '工作日', perWeek: 5, minutes: 30, invisible: false },
  { id: 'pickup', title: '接孩子放学', group: '每天', cadence: '工作日', perWeek: 5, minutes: 40, invisible: false },
  { id: 'dinner', title: '做晚饭', group: '每天', cadence: '每天', perWeek: 7, minutes: 60, invisible: false },
  { id: 'dishes', title: '洗碗、收拾厨房', group: '每天', cadence: '每天', perWeek: 7, minutes: 20, invisible: false },
  { id: 'homework', title: '陪写作业', group: '每天', cadence: '工作日', perWeek: 5, minutes: 45, invisible: false },
  { id: 'bedtime', title: '洗澡、哄睡', group: '每天', cadence: '每天', perWeek: 7, minutes: 40, invisible: false },
  { id: 'tidy', title: '收拾屋子、玩具', group: '每天', cadence: '每天', perWeek: 7, minutes: 30, invisible: false },
  { id: 'laundry', title: '洗衣、晾衣、叠衣', group: '每天', cadence: '每周 4 次', perWeek: 4, minutes: 30, invisible: false },
  { id: 'groceries', title: '买菜', group: '每周', cadence: '每周 4 次', perWeek: 4, minutes: 40, invisible: false },
  { id: 'bathroom', title: '打扫卫生间', group: '每周', cadence: '每周', perWeek: 1, minutes: 40, invisible: false },
  { id: 'floors', title: '拖地、吸尘', group: '每周', cadence: '每周 2 次', perWeek: 2, minutes: 30, invisible: false },
  { id: 'classes', title: '兴趣班接送', group: '每周', cadence: '每周 2 次', perWeek: 2, minutes: 90, invisible: false },
  { id: 'weekend', title: '周末带孩子出门', group: '每周', cadence: '每周', perWeek: 1, minutes: 180, invisible: false },
  { id: 'menu', title: '想吃什么、列买菜单', group: '要记着', cadence: '每天', perWeek: 7, minutes: 10, invisible: true },
  { id: 'chat', title: '看班级群、回老师消息', group: '要记着', cadence: '工作日', perWeek: 5, minutes: 15, invisible: true },
  { id: 'bag', title: '检查书包、签字、备材料', group: '要记着', cadence: '工作日', perWeek: 5, minutes: 10, invisible: true },
  { id: 'deadlines', title: '记缴费、报名、截止日', group: '要记着', cadence: '每周', perWeek: 1, minutes: 20, invisible: true },
  { id: 'supplies', title: '补日用品、囤货', group: '要记着', cadence: '每周', perWeek: 1, minutes: 20, invisible: true },
  { id: 'doctor', title: '约体检、疫苗、看病', group: '要记着', cadence: '每月', perWeek: 0.25, minutes: 120, invisible: true },
  { id: 'clothes', title: '换季衣物、孩子尺码', group: '要记着', cadence: '每月', perWeek: 0.25, minutes: 60, invisible: true },
  { id: 'gifts', title: '生日礼物、人情往来', group: '要记着', cadence: '每月', perWeek: 0.25, minutes: 60, invisible: true },
]

export const restSlots = [
  { id: 'sat-am', label: '周六上午', phrase: '每周六上午' },
  { id: 'sun-pm', label: '周日下午', phrase: '每周日下午' },
  { id: 'night', label: '每晚 8 点后一小时', phrase: '每天晚上 8 点以后的一个小时' },
]

export function localDay(date: string | Date): string {
  const value = new Date(date)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function shiftDay(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return localDay(new Date(year, month - 1, date + offset))
}

export function choreList(tasks: HouseholdTask[]): Chore[] {
  const custom = tasks.filter(task => !chores.some(chore => chore.title === task.title)).map(task => {
    const when = task.when.trim()
    return { id: task.id, title: task.title, group: '每周' as const, cadence: when && when !== '时间待商量' ? when : '每周', perWeek: 1, minutes: 30, invisible: false }
  })
  return [...chores, ...custom]
}

export function entryFor(id: string, ledger: LedgerEntry[], tasks: HouseholdTask[]): LedgerEntry {
  const saved = ledger.find(entry => entry.id === id)
  if (saved) return saved
  const preset = chores.find(chore => chore.id === id)
  const task = tasks.find(item => preset ? item.title === preset.title : item.id === id)
  if (!task) return { id, doer: '我', handOver: false }
  return { id, doer: task.owner === '一起' ? '一起' : '我', handOver: task.owner === '伴侣' || task.owner === '待商量' }
}

export function weeklyLoad(list: Chore[], ledger: LedgerEntry[], tasks: HouseholdTask[]) {
  let me = 0, him = 0, invisibleMine = 0
  for (const chore of list) {
    const minutes = chore.perWeek * chore.minutes
    const { doer } = entryFor(chore.id, ledger, tasks)
    if (doer === '我') me += minutes
    else if (doer === '他') him += minutes
    else { me += minutes / 2; him += minutes / 2 }
    if (chore.invisible && doer !== '他') invisibleMine += 1
  }
  return { me, him, invisibleMine }
}

export function hours(minutes: number): string {
  const value = minutes / 60
  return value < 10 ? String(Math.round(value * 10) / 10) : String(Math.round(value))
}

export function suggestHandOver(list: Chore[], ledger: LedgerEntry[], tasks: HouseholdTask[]): string[] {
  const mine = list.filter(chore => entryFor(chore.id, ledger, tasks).doer !== '他').sort((a, b) => b.perWeek * b.minutes - a.perWeek * a.minutes)
  return [...mine.filter(chore => !chore.invisible).slice(0, 2), ...mine.filter(chore => chore.invisible).slice(0, 1)].map(chore => chore.id)
}

export function buildHandOverMessage(load: { me: number; him: number; invisibleMine: number }, items: Chore[], slotPhrase: string): string {
  const parts = [`我按常见时长粗算了一下家里每周的事：我这边大约 ${hours(load.me)} 小时，你大约 ${hours(load.him)} 小时；其中“要一直记着”的事，有 ${load.invisibleMine} 件在我这里。`]
  if (items.length) parts.push(`想请你从下周开始，完整接手这几件——从记得、安排到做完都交给你，不用我再提醒：\n${items.map(item => `• ${item.title}（${item.cadence}）`).join('\n')}`)
  if (slotPhrase) parts.push(`另外，我想把${slotPhrase}留给自己，那段时间家里和孩子的事先交给你。`)
  parts.push('不是要算账，是我最近真的有点撑不住。哪件不合适，我们再换。')
  return parts.join('\n\n')
}

export const mealTimes: { id: MealTime; label: string; when: string }[] = [
  { id: 'breakfast', label: '早饭', when: '今早' }, { id: 'lunch', label: '午饭', when: '中午' }, { id: 'dinner', label: '晚饭', when: '今晚' },
]
export const dinnerStyles: { id: DinnerStyle; label: string }[] = [
  { id: '', label: '荤素汤' }, { id: 'two', label: '荤素' }, { id: 'easy', label: '一锅一素' }, { id: 'one', label: '一个菜' },
]
const dinnerKinds: Record<DinnerStyle, DishKind[]> = { '': ['meat', 'veg', 'soup'], two: ['meat', 'veg'], easy: ['one', 'veg'], one: ['one'] }

export function mealAt(date: Date): MealTime {
  const hour = date.getHours()
  return hour < 9 ? 'breakfast' : hour < 13 ? 'lunch' : 'dinner'
}

export function mealOf(record: MealRecord): MealTime {
  return record.meal ?? 'dinner'
}

export function mealSlots(meal: MealTime, style: DinnerStyle): { kind: DishKind; quick: boolean }[] {
  if (meal === 'breakfast') return [{ kind: 'breakfast', quick: false }]
  if (meal === 'lunch') return [{ kind: 'one', quick: true }]
  return dinnerKinds[style].map(kind => ({ kind, quick: style === 'easy' && kind === 'veg' }))
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

export function dinnerCandidates(kind: DishKind, meals: MealRecord[], skip: string[], today: string, quick = false, random = Math.random): string[] {
  const since = shiftDay(today, -6)
  const recent = new Set(meals.filter(meal => meal.day <= today && meal.day >= since).flatMap(meal => meal.dishIds))
  let pool = dishes.filter(dish => dish.kind === kind && !skip.includes(dish.id))
  if (quick && pool.some(dish => dish.minutes <= 10)) pool = pool.filter(dish => dish.minutes <= 10)
  return [...shuffle(pool.filter(dish => !recent.has(dish.id)), random), ...shuffle(pool.filter(dish => recent.has(dish.id)), random)].map(dish => dish.id)
}

export function shoppingList(dishIds: string[]): string[] {
  return [...new Set(dishIds.flatMap(id => dishById.get(id)?.items ?? []))]
}

export function recordMeal(meals: MealRecord[], entry: MealRecord): MealRecord[] {
  const next = [...meals.filter(meal => meal.day !== entry.day || mealOf(meal) !== mealOf(entry)), entry].sort((a, b) => a.day.localeCompare(b.day))
  const days = [...new Set(next.map(meal => meal.day))].slice(-30)
  return next.filter(meal => days.includes(meal.day))
}

export function parseFoodShare(text: string): string | null {
  if (!text.trim() || text.length > 4000) return null
  const links = text.match(/https?:\/\/[^\s<>"'，。！？、；（）【】《》]+/gi) ?? []
  for (const link of links) {
    try {
      const url = new URL(link.replace(/[),.!;]+$/, ''))
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && url.hostname.includes('.')) return url.href
    } catch { continue }
  }
  return null
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime())
}

function optionalArray(value: unknown): unknown[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('Invalid saved data')
  return value
}

export function parseStoredData(raw: string | null): StoredData {
  if (!raw) return { ...emptyData }
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object') throw new Error('Invalid saved data')
  const data = value as Record<string, unknown>
  if (!Array.isArray(data.checkIns) || !Array.isArray(data.notes) || !Array.isArray(data.tasks) || !Array.isArray(data.savedIds)) throw new Error('Invalid saved data')
  const checkIns = data.checkIns.filter((entry): entry is CheckIn => !!entry && typeof entry.id === 'string' && moods.some(mood => mood.id === entry.mood) && validDate(entry.date))
  const notes = data.notes.filter((entry): entry is Note => !!entry && typeof entry.id === 'string' && typeof entry.text === 'string' && entry.text.length <= 2000 && typeof entry.tag === 'string' && validDate(entry.date))
  const tasks = data.tasks.filter((entry): entry is HouseholdTask => !!entry && typeof entry.id === 'string' && typeof entry.title === 'string' && entry.title.length <= 80 && ['待商量', '伴侣', '我', '一起'].includes(entry.owner) && typeof entry.when === 'string' && entry.when.length <= 80)
  const savedIds = data.savedIds.filter((id): id is string => typeof id === 'string' && legacyActivityIds.includes(id))
  const ledger = optionalArray(data.ledger).filter((entry): entry is LedgerEntry => !!entry && typeof entry === 'object' && typeof (entry as LedgerEntry).id === 'string' && ['我', '他', '一起'].includes((entry as LedgerEntry).doer) && typeof (entry as LedgerEntry).handOver === 'boolean')
  const savedFoods = optionalArray(data.savedFoods).filter((entry): entry is SavedFood => {
    if (!entry || typeof entry !== 'object') return false
    const food = entry as SavedFood
    return typeof food.id === 'string' && typeof food.text === 'string' && typeof food.url === 'string' && parseFoodShare(food.text) === food.url && validDate(food.date)
  })
  const meals = optionalArray(data.meals).filter((entry): entry is MealRecord => {
    if (!entry || typeof entry !== 'object') return false
    const meal = entry as MealRecord
    return /^\d{4}-\d{2}-\d{2}$/.test(String(meal.day)) && Array.isArray(meal.dishIds) && meal.dishIds.every(id => dishById.has(id)) && (meal.shareId === undefined || savedFoods.some(food => food.id === meal.shareId)) && (meal.meal === undefined || meal.meal === 'breakfast' || meal.meal === 'lunch')
  })
  const skipDishes = optionalArray(data.skipDishes).filter((id): id is string => typeof id === 'string' && dishById.has(id))
  const restSlot = typeof data.restSlot === 'string' && restSlots.some(slot => slot.id === data.restSlot) ? data.restSlot : ''
  const dinnerStyle = dinnerStyles.find(style => style.id === data.dinnerStyle)?.id ?? ''
  return { checkIns, notes, tasks, savedIds, ledger, meals, skipDishes, restSlot, savedFoods, dinnerStyle }
}
