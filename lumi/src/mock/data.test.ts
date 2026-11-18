import { describe, expect, it } from 'vitest'
import type { ChatRequest, ChecklistCard, ForecastCard, ItineraryCard, ReminderCard, RouteCard } from '../api/types'
import { createMockReply, getMockHomeOverview } from './data'

const request = (query: string, history?: ChatRequest['history']): ChatRequest => ({ conversationId: 'test', city: '杭州', query, history })
const now = new Date('2026-11-17T10:00:00.000Z') // Tuesday, 18:00 Beijing.

describe('mock cards', () => {
  it.each([
    ['明天穿什么', 'weather'], ['推荐一家餐厅', 'restaurants'], ['番茄炒蛋怎么做', 'recipe'],
    ['推荐酒店', 'hotels'], ['去西湖', 'route'], ['附近咖啡', 'places'],
    ['提醒我明天晚上七点取快递', 'reminder'], ['整理房间', 'home'],
    ['周末去西湖玩一天', 'itinerary'], ['出门要带什么', 'checklist'], ['这周天气怎么样', 'forecast'],
  ])('%s supplies a %s card', (query, type) => {
    const reply = createMockReply(request(query), now)
    expect(reply.cards[0].type).toBe(type)
    expect(reply.suggestions.length).toBeGreaterThan(0)
    expect(reply.text).not.toBe('')
  })

  it.each([
    ['推荐一家餐厅', 3], ['推荐酒店', 2], ['去西湖', 3], ['周末去西湖玩一天', 3], ['出门要带什么', 2],
    ['明天穿什么', 0], ['番茄炒蛋怎么做', 0], ['这周天气怎么样', 0], ['提醒我明天晚上七点取快递', 0],
  ])('%s has a %i-step plan and a short thinking summary', (query, steps) => {
    const reply = createMockReply(request(query), now)
    expect(reply.plan).toHaveLength(steps)
    expect(reply.thinking.length).toBeGreaterThan(0)
    expect(reply.thinking.length).toBeLessThan(120)
  })

  it('has no process for chitchat or out-of-scope replies', () => {
    for (const query of ['你好呀', '上海今天穿什么', '导航到火星餐厅']) {
      const reply = createMockReply(request(query), now)
      expect(reply.plan).toEqual([])
      expect(reply.thinking).toBe('')
    }
  })

  it('keeps forecast day one consistent with today and suggests a reminder on the rainy day', () => {
    const overview = getMockHomeOverview(now)
    const card = createMockReply(request('这周天气怎么样'), now).cards[0] as ForecastCard
    expect(card.days).toHaveLength(5)
    expect(card.days[0]).toMatchObject({ label: '今天', condition: overview.condition, low: overview.low, high: overview.high })
    const rainy = card.days.reduce((best, day) => day.rain > best.rain ? day : best)
    expect(createMockReply(request('这周天气怎么样'), now).suggestions).toContain(`提醒我${rainy.label}早上八点带伞`)
  })

  it('only offers itinerary routes for supported destinations', () => {
    const card = createMockReply(request('周末去西湖玩一天'), now).cards[0] as ItineraryCard
    expect(card.stops.length).toBeGreaterThanOrEqual(3)
    for (const stop of card.stops) {
      if (stop.route) expect(createMockReply(request(stop.route), now).cards[0].type).toBe('route')
    }
    expect(card.stops.filter(stop => stop.route)).toHaveLength(2)
  })

  it('picks grocery or packing checklists from context', () => {
    const grocery = createMockReply(request('列个买菜清单'), now).cards[0] as ChecklistCard
    const packing = createMockReply(request('明天去西湖要带什么'), now).cards[0] as ChecklistCard
    expect(grocery.id).toBe('checklist-grocery')
    expect(packing.id).toBe('checklist-packing')
    for (const card of [grocery, packing]) {
      expect(card.groups.every(group => group.items.length > 0)).toBe(true)
      expect(new Set(card.groups.flatMap(group => group.items)).size).toBe(card.groups.flatMap(group => group.items).length)
    }
  })

  it('keeps data small, uses semantic colors, and supplies real current China date', () => {
    expect(getMockHomeOverview(new Date('2026-11-17T17:00:00Z'))).toMatchObject({ city: '杭州', date: '2026-11-18' })
    const food = createMockReply(request('推荐餐厅')).cards[0]
    expect(food.type).toBe('restaurants')
    if (food.type === 'restaurants') {
      expect(food.items).toHaveLength(3)
      expect(food.items.map(item => item.color)).toEqual(['peach', 'sage', 'sand'])
    }
    const hotel = createMockReply(request('推荐酒店')).cards[0]
    if (hotel.type === 'hotels') expect(hotel.items).toHaveLength(2)
    const weather = createMockReply(request('明天穿什么')).cards[0]
    if (weather.type === 'weather') expect(weather.hourly.length).toBeGreaterThan(3)
  })

  it('has recipe ingredients and steps and keeps a lighter recipe in followup history', () => {
    const original = createMockReply(request('番茄炒蛋怎么做')).cards[0]
    if (original.type !== 'recipe') throw new Error('expected recipe')
    expect(original.name).toBe('番茄炒蛋')
    expect(original.ingredients).toHaveLength(5)
    expect(original.steps).toHaveLength(4)
    const history: ChatRequest['history'] = [{ role: 'user', content: '番茄炒蛋怎么做' }, { role: 'user', content: '清淡一点' }]
    const light = createMockReply(request('详细步骤', history)).cards[0]
    expect(light).toMatchObject({ type: 'recipe', name: '冬瓜虾仁汤' })
  })

  it.each(['推荐餐厅', '推荐酒店', '附近咖啡'])('states the limited example scope and avoids misleading chips for %s', query => {
    const reply = createMockReply(request('换一家', [{ role: 'user', content: query }]))
    expect(reply.text).toMatch(/仅|只/)
    expect(reply.text).toMatch(/调整.*顺序/)
    expect(reply.suggestions).not.toContain('换一家')
  })

  it('rotates restaurants and hotels for 换一家', () => {
    for (const query of ['推荐餐厅', '推荐酒店']) {
      const initial = createMockReply(request(query)).cards[0]
      const changed = createMockReply(request('换一家', [{ role: 'user', content: query }])).cards[0]
      if ((initial.type === 'restaurants' || initial.type === 'hotels') && (changed.type === 'restaurants' || changed.type === 'hotels')) {
        expect(changed.items[0].id).not.toBe(initial.items[0].id)
      } else throw new Error('expected listing cards')
    }
  })

  it.each([
    ['提醒我明天晚上七点取快递', '2026-11-18T11:00:00.000Z', '取快递'],
    ['提醒我后天上午九点半买菜', '2026-11-19T01:30:00.000Z', '买菜'],
    ['提醒我明天下午3:15开会', '2026-11-18T07:15:00.000Z', '开会'],
    ['提醒我今晚七点取快递', '2026-11-17T11:00:00.000Z', '取快递'],
    ['提醒我今天上午九点买菜', '2026-11-18T01:00:00.000Z', '买菜'],
    ['提醒我20分钟后休息', '2026-11-17T10:20:00.000Z', '休息'],
    ['提醒我下周一上午九点开会', '2026-11-23T01:00:00.000Z', '开会'],
  ])('parses future reminder %s', (query, dueAt, title) => {
    const card = createMockReply(request(query), now).cards[0] as ReminderCard
    expect(card).toMatchObject({ type: 'reminder', dueAt, title })
    expect(Date.parse(card.dueAt)).toBeGreaterThan(now.getTime())
    expect(card.note).toContain('北京时间')
  })

  it('never outputs a past reminder even when it is late at night', () => {
    const late = new Date('2026-11-17T15:59:00Z')
    const card = createMockReply(request('提醒我今天晚上七点取快递'), late).cards[0] as ReminderCard
    expect(Date.parse(card.dueAt)).toBeGreaterThan(late.getTime())
    expect(card.note).toContain('顺延')
  })

  it.each([
    ['去西湖', { lng: 120.1648, lat: 30.2538 }],
    ['去杭州东站', { lng: 120.2192, lat: 30.2976 }],
    ['去灵隐寺', { lng: 120.1083, lat: 30.2467 }],
  ])('uses fixed Hangzhou coordinates and independent polylines for %s', (query, point) => {
    const card = createMockReply(request(query)).cards[0] as RouteCard
    expect(card.destinationPoint).toEqual(point)
    expect(card.originPoint).toEqual({ lng: 120.1691, lat: 30.2804 })
    expect(card.options).toHaveLength(4)
    expect(new Set(card.options.map(option => JSON.stringify(option.points))).size).toBe(4)
    for (const option of card.options) {
      expect(option.points[0]).toEqual(card.originPoint)
      expect(option.points.at(-1)).toEqual(point)
    }
    const followup = createMockReply(request('换一种方式', [{ role: 'user', content: query }])).cards[0]
    expect(followup).toMatchObject({ type: 'route', destinationPoint: point, recommended: 'cycling' })
  })

  it('asks for a supported destination without inventing navigation points', () => {
    const reply = createMockReply(request('导航到火星餐厅'))
    expect(reply.cards).toEqual([])
    expect(reply.text).toContain('不生成猜测的路线')
    expect(createMockReply(request('导航到火星餐厅', [{ role: 'user', content: '去西湖' }])).cards).toEqual([])
  })

  it('does not silently replace a requested origin or city', () => {
    expect(createMockReply(request('从西湖到杭州东站怎么走')).cards).toEqual([])
    expect(createMockReply(request('上海今天穿什么')).cards).toEqual([])
  })

  it('asks for a reminder time and rejects repeated reminders', () => {
    expect(createMockReply(request('提醒我带伞')).cards).toEqual([])
    expect(createMockReply(request('每周一九点提醒我开会')).cards).toEqual([])
  })

  it('keeps different tasks at the same time as separate reminders', () => {
    const first = createMockReply(request('提醒我明天七点取快递'), now).cards[0] as ReminderCard
    const second = createMockReply(request('提醒我明天七点倒垃圾'), now).cards[0] as ReminderCard
    expect(first.id).not.toBe(second.id)
  })
})
