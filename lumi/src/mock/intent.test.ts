import { describe, expect, it } from 'vitest'
import type { ChatRequest, Intent } from '../api/types'
import { detectIntent } from './intent'

describe('detectIntent', () => {
  it.each<[string, Intent]>([
    ['明天穿什么', 'weather_outfit'], ['杭州今天下雨吗', 'weather_outfit'],
    ['去西湖穿什么', 'weather_outfit'],
    ['推荐几家附近适合午饭的餐厅', 'food_recommend'],
    ['周末想在西湖附近住一晚，有什么推荐？', 'hotel_recommend'],
    ['附近有什么好吃的', 'food_recommend'],
    ['推荐一家餐厅', 'food_recommend'], ['午餐吃什么', 'food_recommend'],
    ['番茄炒蛋怎么做', 'recipe'], ['推荐一道简单菜', 'recipe'],
    ['找个西湖附近的酒店', 'hotel_recommend'], ['去餐厅怎么走', 'route_plan'],
    ['去西湖', 'route_plan'], ['去杭州东站', 'route_plan'], ['前往灵隐寺', 'route_plan'],
    ['附近咖啡', 'nearby_search'], ['周边便利店', 'nearby_search'],
    ['提醒我明天晚上七点取快递', 'reminder'], ['帮我整理房间', 'home_care'], ['你好呀', 'chitchat'],
    ['周末去西湖玩一天', 'day_plan'], ['杭州一日游怎么安排', 'day_plan'], ['周六去哪', 'day_plan'],
    ['明天去西湖要带什么', 'checklist'], ['下雨出门带什么', 'checklist'], ['列个买菜清单', 'checklist'],
    ['提醒我明天带伞', 'reminder'], ['打开我的清单', 'chitchat'],
    ['这周天气怎么样', 'weather_outfit'], ['未来几天会下雨吗', 'weather_outfit'],
  ])('%s → %s', (query, intent) => expect(detectIntent(query)).toBe(intent))

  it.each<[string, string, Intent]>([
    ['推荐一家餐厅', '换一家', 'food_recommend'], ['推荐午餐', '清淡一点', 'food_recommend'],
    ['找个酒店', '换一家', 'hotel_recommend'], ['附近咖啡', '换一家', 'nearby_search'],
    ['番茄炒蛋怎么做', '详细步骤', 'recipe'], ['番茄炒蛋怎么做', '清淡一点', 'recipe'],
    ['去西湖怎么走', '换一种方式', 'route_plan'],
    ['周末去西湖玩一天', '换一个', 'day_plan'], ['出门要带什么', '再详细一点', 'checklist'],
  ])('inherits %s for %s', (previous, query, intent) => {
    const history: ChatRequest['history'] = [
      { role: 'user', content: previous }, { role: 'assistant', content: '也可以看一下天气和附近餐厅。' },
    ]
    expect(detectIntent(query, history)).toBe(intent)
  })

  it('skips prior followups and honors a new explicit intent', () => {
    const history: ChatRequest['history'] = [{ role: 'user', content: '找个酒店' }, { role: 'user', content: '换一家' }]
    expect(detectIntent('换一家', history)).toBe('hotel_recommend')
    expect(detectIntent('番茄炒蛋怎么做', history)).toBe('recipe')
  })
})
