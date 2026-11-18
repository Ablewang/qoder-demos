import { describe, expect, it, vi } from 'vitest'
import { dishById, dishes } from './dishes'
import { buildHandOverMessage, choreList, chores, dinnerCandidates, emptyData, entryFor, hours, mealAt, mealSlots, parseFoodShare, parseStoredData, recordMeal, shoppingList, suggestHandOver, weeklyLoad } from './model'
import type { HouseholdTask, LedgerEntry } from './model'

const fixed = () => 0.5

describe('本机记录', () => {
  it('空存储没有虚构的私人记录', () => { expect(parseStoredData(null)).toEqual(emptyData) })
  it('旧版记录缺少新字段时照常读取', () => {
    const old = { checkIns: [{ id: 'c', mood: 'lonely', date: '2026-11-16T09:00:00.000Z' }], notes: [], tasks: [], savedIds: ['tea'] }
    expect(parseStoredData(JSON.stringify(old))).toEqual({ ...emptyData, checkIns: old.checkIns, savedIds: ['tea'] })
  })
  it('非法 JSON 报错，非法记录被过滤', () => {
    expect(() => parseStoredData('{')).toThrow()
    expect(() => parseStoredData('null')).toThrow()
    expect(() => parseStoredData(JSON.stringify({ ...emptyData, ledger: 'x' }))).toThrow()
    const parsed = parseStoredData(JSON.stringify({ ...emptyData, checkIns: [{ id: 'bad', mood: 'unknown', date: 'bad' }, null], savedIds: ['tea', 'unknown'], ledger: [{ id: 'dinner', doer: '她', handOver: true }, { id: 'dinner', doer: '他', handOver: false }], meals: [{ day: '2026-11-17', dishIds: ['nope'] }], skipDishes: ['nope', 'mapo-tofu'], restSlot: 'midnight' }))
    expect(parsed.checkIns).toEqual([])
    expect(parsed.savedIds).toEqual(['tea'])
    expect(parsed.ledger).toEqual([{ id: 'dinner', doer: '他', handOver: false }])
    expect(parsed.meals).toEqual([])
    expect(parsed.skipDishes).toEqual(['mapo-tofu'])
    expect(parsed.restSlot).toBe('')
  })
})

describe('分享收藏解析', () => {
  const douyinUrl = 'https://v.douyin.com/test-food/'
  const xhsUrl = 'https://xhslink.com/test-food'
  const date = '2026-11-18T09:00:00.000Z'
  const douyinText = `3.21 复制打开抖音，看看【今晚吃点好的】的作品\n${douyinUrl}。 11/18 留给周末做`
  const xhsText = `这碗热汤想做给家人吃 <小红书分享>\n${xhsUrl}，复制本条信息，打开小红书查看！`
  const food = { id: 'share-1', text: douyinText, url: douyinUrl, date }

  it.each([
    ['抖音分享原文', douyinText, douyinUrl],
    ['小红书分享原文', xhsText, xhsUrl],
    ['纯链接', douyinUrl, douyinUrl],
    ['前后空白', `  \n${xhsUrl}\n  `, xhsUrl],
    ['中文包围和多标点', `想吃【${douyinUrl}】。！？、；`, douyinUrl],
    ['常见英文尾标点', `链接 (${douyinUrl}),.!;`, douyinUrl],
    ['保留查询参数与锚点', `${xhsUrl}?source=share&name=%E6%B1%A4#recipe。`, `${xhsUrl}?source=share&name=%E6%B1%A4#recipe`],
    ['规范化协议主机默认端口及路径', 'HTTPS://XHSLINK.COM:443/old/../test-food', xhsUrl],
    ['支持 HTTP', 'http://XHSLINK.COM:80/test-food。', 'http://xhslink.com/test-food'],
    ['返回第一个有效链接', `先看 ${douyinUrl} 再看 ${xhsUrl}`, douyinUrl],
    ['跳过无效及带凭据链接', `https://example.com:bad/ https://user:secret@example.com/ ${xhsUrl}`, xhsUrl],
  ])('%s', (_name, text, expected) => {
    expect(parseFoodShare(text)).toBe(expected)
  })

  it.each([
    ['', '空内容'],
    ['  \n\t', '仅空白'],
    ['今晚想吃热汤，没有网页链接', '无链接原文'],
    ['v.douyin.com/test-food/', '缺少协议'],
    ['javascript:alert(1)', 'javascript 协议'],
    ['data:text/html,<script>alert(1)</script>', 'data 协议'],
    ['file:///tmp/food.html', 'file 协议'],
    ['https://', '缺少主机'],
    ['https://[invalid]/food', '非法主机'],
    ['https://example.com:70000/food', '非法端口'],
    ['https://user:secret@v.douyin.com/test-food/', '用户名和密码'],
    ['https://user@xhslink.com/test-food', '只有用户名'],
    ['https://:secret@xhslink.com/test-food', '只有密码'],
  ])('拒绝%s（%s）', (text) => {
    expect(parseFoodShare(text)).toBeNull()
  })

  it('长度上限包含整个原文，4000 字可保存，4001 字拒绝', () => {
    const boundary = `${'想'.repeat(4000 - douyinUrl.length)}${douyinUrl}`
    expect(boundary).toHaveLength(4000)
    expect(parseFoodShare(boundary)).toBe(douyinUrl)
    expect(parseFoodShare(`${boundary}。`)).toBeNull()
    expect(parseFoodShare(`${douyinUrl}${' '.repeat(4001 - douyinUrl.length)}`)).toBeNull()
  })

  it('序列化往返保留原文，包括换行、前后空白及 HTML 字符，不请求链接', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not fetch'))
    try {
      const text = `  ${xhsText}\n<img src="x" onerror="alert(1)"><script>alert(1)</script> & 未分析  `
      const saved = { id: 'share-html', text, url: xhsUrl, date }
      expect(parseFoodShare(text)).toBe(xhsUrl)
      const parsed = parseStoredData(JSON.stringify({ ...emptyData, savedFoods: [saved] }))
      expect(parsed.savedFoods).toEqual([saved])
      expect(parsed.savedFoods[0].text).toBe(text)
      expect(parseStoredData(JSON.stringify(parsed)).savedFoods).toEqual([saved])
      expect(fetch).not.toHaveBeenCalled()
    } finally { fetch.mockRestore() }
  })

  it('保存 URL 必须与原文解析结果完全一致，损坏及不安全收藏被过滤', () => {
    const invalid = [
      null, 'bad', {},
      { ...food, id: 1 },
      { ...food, text: null },
      { ...food, url: null },
      { ...food, url: xhsUrl },
      { ...food, url: 'HTTPS://V.DOUYIN.COM:443/test-food/' },
      { ...food, date: 'not-a-date' },
      { ...food, date: null },
      { ...food, text: `${douyinText}${'想'.repeat(4000)}` },
      ...['javascript:alert(1)', 'data:text/html,food', 'file:///tmp/food', 'https://user:secret@v.douyin.com/test-food/'].map(url => ({ ...food, text: url, url })),
    ]
    expect(parseStoredData(JSON.stringify({ ...emptyData, savedFoods: [food, ...invalid] })).savedFoods).toEqual([food])
    expect(() => parseStoredData(JSON.stringify({ ...emptyData, savedFoods: {} }))).toThrow()
  })

  it('旧版缺少收藏字段时默认空数组，所有旧字段与菜谱记录不丢', () => {
    const old = {
      checkIns: [{ id: 'c', mood: 'lonely', date }],
      notes: [{ id: 'n', text: '今天的原话', tag: '想说没说的', date }],
      tasks: [{ id: 't', title: '倒垃圾', owner: '一起', when: '周五' }],
      savedIds: ['tea'],
      ledger: [{ id: 'dinner', doer: '他', handOver: true }],
      meals: [{ day: '2026-11-17', dishIds: ['tomato-egg'] }],
      skipDishes: ['mapo-tofu'],
      restSlot: 'sat-am',
    }
    const raw = JSON.stringify(old)
    const parsed = parseStoredData(raw)
    expect(parsed).toEqual({ ...old, savedFoods: [], dinnerStyle: '' })
    expect(parseStoredData(JSON.stringify({ ...parsed, savedFoods: [food] }))).toEqual({ ...old, savedFoods: [food], dinnerStyle: '' })
    expect(JSON.stringify(old)).toBe(raw)
  })

  it('分享晚饭引用有效收藏，无菜谱不虚构购物食材，不影响原有推荐', () => {
    const meals = [{ day: '2026-11-17', dishIds: ['tomato-egg'] }, { day: '2026-11-18', dishIds: [], shareId: food.id }]
    const parsed = parseStoredData(JSON.stringify({ ...emptyData, savedFoods: [food], meals }))
    expect(parsed.meals).toEqual(meals)
    expect(shoppingList(parsed.meals[1].dishIds)).toEqual([])
    expect(dinnerCandidates('meat', [meals[1]], [], '2026-11-19', false, fixed)).toEqual(dinnerCandidates('meat', [], [], '2026-11-19', false, fixed))
  })

  it('悬挂 shareId 的整条晚饭被过滤，包括指向损坏收藏的记录', () => {
    const normal = { day: '2026-11-16', dishIds: ['tomato-egg'] }
    const valid = { day: '2026-11-18', dishIds: [], shareId: food.id }
    const missing = { day: '2026-11-17', dishIds: ['kungpao'], shareId: 'missing' }
    const broken = { ...food, id: 'broken', date: 'invalid' }
    const meals = [normal, missing, valid, { day: '2026-11-19', dishIds: [], shareId: broken.id }]
    expect(parseStoredData(JSON.stringify({ ...emptyData, savedFoods: [food, broken], meals })).meals).toEqual([normal, valid])
    expect(parseStoredData(JSON.stringify({ ...emptyData, meals })).meals).toEqual([normal])
  })
})

describe('吃什么', () => {
  const kinds = (meal: Parameters<typeof mealSlots>[0], style: Parameters<typeof mealSlots>[1] = '') => mealSlots(meal, style).map(slot => slot.kind)
  it('菜谱 id 唯一，每类都有足够候选', () => {
    expect(dishById.size).toBe(dishes.length)
    for (const kind of ['meat', 'veg', 'soup', 'one', 'breakfast'] as const) expect(dishes.filter(dish => dish.kind === kind).length).toBeGreaterThanOrEqual(6)
  })
  it('按打开时间默认：9 点前早饭，13 点前午饭，之后晚饭', () => {
    expect(mealAt(new Date(2026, 10, 18, 6, 30))).toBe('breakfast')
    expect(mealAt(new Date(2026, 10, 18, 8, 59))).toBe('breakfast')
    expect(mealAt(new Date(2026, 10, 18, 9, 0))).toBe('lunch')
    expect(mealAt(new Date(2026, 10, 18, 12, 59))).toBe('lunch')
    expect(mealAt(new Date(2026, 10, 18, 13, 0))).toBe('dinner')
    expect(mealAt(new Date(2026, 10, 18, 23, 0))).toBe('dinner')
  })
  it('早饭一样早点，午饭一个十分钟内的一锅饭，晚饭有四种吃法', () => {
    expect(kinds('breakfast', 'two')).toEqual(['breakfast'])
    expect(mealSlots('lunch', '')).toEqual([{ kind: 'one', quick: true }])
    expect(kinds('dinner')).toEqual(['meat', 'veg', 'soup'])
    expect(kinds('dinner', 'two')).toEqual(['meat', 'veg'])
    expect(mealSlots('dinner', 'easy')).toEqual([{ kind: 'one', quick: false }, { kind: 'veg', quick: true }])
    expect(kinds('dinner', 'one')).toEqual(['one'])
    expect(dinnerCandidates('veg', [], [], '2026-11-17', true, fixed).every(id => dishById.get(id)!.minutes <= 10)).toBe(true)
    expect(dinnerCandidates('one', [], [], '2026-11-17', true, fixed).length).toBeGreaterThanOrEqual(5)
  })
  it('最近六天吃过的排到最后，包括今天别的顿，更早的不受影响', () => {
    const meals = [{ day: '2026-11-15', dishIds: ['tomato-egg'] }, { day: '2026-11-01', dishIds: ['kungpao'] }]
    const list = dinnerCandidates('meat', meals, [], '2026-11-17', false, fixed)
    expect(list.at(-1)).toBe('tomato-egg')
    expect(list.indexOf('kungpao')).toBeLessThan(list.length - 1)
    expect(dinnerCandidates('one', [{ day: '2026-11-17', dishIds: ['fried-rice'], meal: 'lunch' }], [], '2026-11-17', false, fixed).at(-1)).toBe('fried-rice')
  })
  it('不吃的菜永远不出现', () => {
    expect(dinnerCandidates('soup', [], ['seaweed-egg'], '2026-11-17', false, fixed)).not.toContain('seaweed-egg')
  })
  it('买菜清单合并重复食材', () => {
    const list = shoppingList(['tomato-egg', 'tomato-soup'])
    expect(list.filter(item => item === '番茄')).toHaveLength(1)
    expect(list).toContain('鸡蛋')
  })
  it('同一天同一顿重定只保留最后一次，三顿互不覆盖，最多留三十天', () => {
    let meals = recordMeal([], { day: '2026-11-17', dishIds: ['tomato-egg'] })
    meals = recordMeal(meals, { day: '2026-11-17', dishIds: ['kungpao'] })
    expect(meals).toEqual([{ day: '2026-11-17', dishIds: ['kungpao'] }])
    meals = recordMeal(meals, { day: '2026-11-17', dishIds: ['oat-milk'], meal: 'breakfast' })
    meals = recordMeal(meals, { day: '2026-11-17', dishIds: ['fried-rice'], meal: 'lunch' })
    meals = recordMeal(meals, { day: '2026-11-17', dishIds: ['hand-cake'], meal: 'breakfast' })
    expect(meals).toEqual([{ day: '2026-11-17', dishIds: ['kungpao'] }, { day: '2026-11-17', dishIds: ['fried-rice'], meal: 'lunch' }, { day: '2026-11-17', dishIds: ['hand-cake'], meal: 'breakfast' }])
    for (let day = 1; day <= 40; day += 1) meals = recordMeal(meals, { day: `2026-10-${String(day).padStart(2, '0')}`, dishIds: ['kungpao'] })
    expect(new Set(meals.map(meal => meal.day)).size).toBe(30)
  })
  it('旧记录没有顿次算晚饭；吃法偏好非法时回到荤素汤', () => {
    const meals = [{ day: '2026-11-17', dishIds: ['kungpao'] }, { day: '2026-11-17', dishIds: ['oat-milk'], meal: 'breakfast' }, { day: '2026-11-17', dishIds: [], meal: 'supper' }]
    const parsed = parseStoredData(JSON.stringify({ ...emptyData, meals, dinnerStyle: 'two' }))
    expect(parsed.meals).toEqual(meals.slice(0, 2))
    expect(parsed.dinnerStyle).toBe('two')
    expect(parseStoredData(JSON.stringify({ ...emptyData, dinnerStyle: 'many' })).dinnerStyle).toBe('')
  })
})

describe('家务账', () => {
  const none: LedgerEntry[] = []
  it('默认全部算我在做，时长合计不为零', () => {
    const load = weeklyLoad(chores, none, [])
    expect(load.him).toBe(0)
    expect(load.me).toBeGreaterThan(20 * 60)
    expect(load.invisibleMine).toBe(chores.filter(chore => chore.invisible).length)
  })
  it('他做的计到他，一起做的各算一半', () => {
    const ledger: LedgerEntry[] = [{ id: 'dinner', doer: '他', handOver: false }, { id: 'pickup', doer: '一起', handOver: false }]
    const base = weeklyLoad(chores, none, [])
    const load = weeklyLoad(chores, ledger, [])
    expect(load.him).toBe(7 * 60 + 5 * 40 / 2)
    expect(load.me).toBe(base.me - load.him)
  })
  it('旧版分工事项映射到家务账：伴侣负责算想交出去', () => {
    const tasks: HouseholdTask[] = [{ id: 'x', title: '接孩子放学', owner: '伴侣', when: '周五下午' }, { id: 'y', title: '倒垃圾', owner: '一起', when: '' }]
    expect(entryFor('pickup', none, tasks)).toEqual({ id: 'pickup', doer: '我', handOver: true })
    const list = choreList(tasks)
    expect(list.filter(chore => chore.title === '接孩子放学')).toHaveLength(1)
    expect(list.find(chore => chore.id === 'y')).toMatchObject({ title: '倒垃圾', cadence: '每周' })
    expect(entryFor('y', none, tasks).doer).toBe('一起')
  })
  it('帮我挑：两件最耗时的体力活加一件最耗时的记挂事，不挑他已在做的', () => {
    expect(suggestHandOver(chores, none, [])).toEqual(['dinner', 'bedtime', 'chat'])
    expect(suggestHandOver(chores, [{ id: 'dinner', doer: '他', handOver: false }], [])).not.toContain('dinner')
  })
  it('发给他的话写清时长、交接内容和留白时段，不替他答应', () => {
    const items = chores.filter(chore => chore.id === 'dinner')
    const text = buildHandOverMessage({ me: 1800, him: 120, invisibleMine: 8 }, items, '每周六上午')
    expect(text).toContain('我这边大约 30 小时，你大约 2 小时')
    expect(text).toContain('• 做晚饭（每天）')
    expect(text).toContain('完整接手')
    expect(text).toContain('每周六上午留给自己')
    expect(text).toContain('哪件不合适，我们再换')
    expect(buildHandOverMessage({ me: 60, him: 0, invisibleMine: 0 }, [], '')).not.toContain('接手')
  })
  it('小时数：十小时内保留一位小数', () => {
    expect(hours(95)).toBe('1.6')
    expect(hours(1530)).toBe('26')
  })
})
