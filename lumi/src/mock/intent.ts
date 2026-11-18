import type { ChatRequest, Intent } from '../api/types'

function explicitIntent(query: string): Intent {
  if (/提醒|备忘|闹钟|记得|别忘/.test(query)) return 'reminder'
  if (!/我的清单/.test(query) && /带什么|带哪些|要带|打包|行李|准备什么|准备哪些|列个清单|出行清单|购物清单|买菜清单|采购/.test(query)) return 'checklist'
  if (/一日游|半日游|玩一天|逛一天|行程|周末去哪|怎么玩|(?:一天|半天|周末|周六|周日).*(?:怎么逛|去哪)/.test(query)) return 'day_plan'
  if (/怎么走|如何(?:去|到)|路线|导航|交通|地铁|公交|打车|步行|骑行|开车|换一种方式/.test(query)) return 'route_plan'
  if (/菜谱|食谱|详细步骤|烹饪|做法|怎么做|如何做|炒蛋|炖汤|简单菜/.test(query)) return 'recipe'
  if (/天气|气温|温度|下雨|下雪|穿什么|穿搭|穿衣|搭配|冷不冷|热不热/.test(query)) return 'weather_outfit'
  if (/酒店|民宿|住宿|住哪|住一晚|住两晚|住几晚|小住|订房/.test(query)) return 'hotel_recommend'
  if (/附近.*咖啡|咖啡.*附近/.test(query)) return 'nearby_search'
  if (/吃什么|吃点|吃饭|餐厅|美食|午餐|晚餐|早餐|午饭|晚饭|早饭|好吃|咖啡|清淡|推荐.*吃/.test(query)) return 'food_recommend'
  if (/家务|收纳|打扫|清洁|洗衣|晾晒|养护|绿植|居家|整理房间/.test(query)) return 'home_care'
  if (/(?:去|到|前往).*(?:西湖|杭州东站|灵隐寺)/.test(query)) return 'route_plan'
  if (/附近|周边|便利店|药店|公园|书店/.test(query)) return 'nearby_search'
  return 'chitchat'
}

export function detectIntent(query: string, history: ChatRequest['history'] = []): Intent {
  const followUp = /^(?:请|帮我)?\s*(?:换一家|换一间|换一个|清淡一点|详细步骤|换一种方式|再详细一点|展开说说)[！!。？?\s]*$/.test(query.trim())
  if (followUp) {
    for (const role of ['user', 'assistant'] as const) {
      for (let index = history.length - 1; index >= 0; index -= 1) {
        const message = history[index]
        if (message.role !== role || /^(?:换一家|换一间|换一个|清淡一点|详细步骤|换一种方式)[！!。？?\s]*$/.test(message.content.trim())) continue
        const intent = explicitIntent(message.content)
        if (intent !== 'chitchat') return intent
      }
    }
    if (/详细步骤/.test(query)) return 'recipe'
    if (/换一种方式/.test(query)) return 'route_plan'
    if (/清淡|换一家/.test(query)) return 'food_recommend'
  }
  return explicitIntent(query)
}
