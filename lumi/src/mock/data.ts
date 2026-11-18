import type {
  AgentCard, ChatRequest, ChecklistCard, ForecastCard, HomeOverview, Hotel, Intent, ItineraryCard, Point, RecipeCard,
  ReminderCard, Restaurant, RouteCard, RouteMode, WeatherCard,
} from '../api/types'
import { detectIntent } from './intent'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const CHINA_OFFSET = 8 * HOUR

function chinaDate(now: Date): string {
  return new Date(now.getTime() + CHINA_OFFSET).toISOString().slice(0, 10)
}

export function getMockHomeOverview(now = new Date()): HomeOverview {
  return {
    city: '杭州', date: chinaDate(now), temperature: 22, condition: '多云', low: 17, high: 25,
    airQuality: '良', outfitTip: '薄外套搭配舒适长裤，早晚出门记得加一层。',
    dailyTip: '留出十分钟散步，也给自己一点不赶时间的空间。',
  }
}

const restaurants: Restaurant[] = [
  { id: 'restaurant-1', name: '新白鹿 · 湖滨店', category: '杭帮菜', rating: 4.7, price: 68, distance: '850 米', walkMinutes: 12, tags: ['家常口味', '适合两人'], address: '杭州湖滨商圈（模拟门店）', point: { lng: 120.1696, lat: 30.2571 }, color: 'peach' },
  { id: 'restaurant-2', name: '清禾蔬食', category: '轻食 · 素食', rating: 4.8, price: 45, distance: '600 米', walkMinutes: 9, tags: ['清淡少油', '时令蔬菜'], address: '杭州凤起路商圈（示意门店）', point: { lng: 120.1721, lat: 30.2713 }, color: 'sage' },
  { id: 'restaurant-3', name: '巷口面馆', category: '面食 · 小吃', rating: 4.6, price: 28, distance: '350 米', walkMinutes: 5, tags: ['一人食', '热汤暖胃'], address: '杭州武林商圈（示意门店）', point: { lng: 120.1682, lat: 30.2781 }, color: 'sand' },
]

const hotels: Hotel[] = [
  { id: 'hotel-1', name: '湖畔小住', area: '西湖湖滨', rating: 4.8, price: 468, tags: ['步行逛湖', '安静舒适'], address: '杭州湖滨路一带（示意酒店）', point: { lng: 120.1647, lat: 30.2562 }, description: '暖木色客房与舒适阅读角，适合慢慢逛西湖的周末。价格、房态和位置均为模拟。' },
  { id: 'hotel-2', name: '城东轻居', area: '杭州东站周边', rating: 4.6, price: 328, tags: ['交通方便', '简约客房'], address: '杭州东站西广场一带（示意酒店）', point: { lng: 120.2148, lat: 30.2962 }, description: '适合短途出差或次日赶车，设有简洁工作区。价格、房态和位置均为模拟。' },
]

const tomatoRecipe: RecipeCard = {
  type: 'recipe', name: '番茄炒蛋', minutes: 15, servings: 2, difficulty: '新手友好',
  ingredients: [{ name: '番茄', amount: '2 个' }, { name: '鸡蛋', amount: '3 个' }, { name: '食用油', amount: '2 茶匙' }, { name: '盐', amount: '适量' }, { name: '葱花', amount: '少许（可选）' }],
  steps: ['番茄洗净切块；鸡蛋打散，加入一小撮盐。', '锅中放一茶匙油，中火倒入蛋液，凝固后轻推成块并盛出。', '补一茶匙油，放番茄翻炒两分钟，加入两汤匙水，煮至出汁。', '倒回鸡蛋，轻轻翻拌一分钟，按口味加盐并撒葱花。'],
  tip: '番茄酸味足时可选加少量糖；清淡版少盐，不额外加糖。鸡蛋应充分熟透。',
}

const lightRecipe: RecipeCard = {
  type: 'recipe', name: '冬瓜虾仁汤', minutes: 20, servings: 2, difficulty: '简单',
  ingredients: [{ name: '冬瓜', amount: '300 克' }, { name: '虾仁', amount: '150 克' }, { name: '姜', amount: '2 片' }, { name: '水', amount: '600 毫升' }, { name: '盐', amount: '少许' }],
  steps: ['冬瓜去皮去瓤切薄片，虾仁去虾线并洗净。', '锅中加水和姜片，烧开后放入冬瓜，小火煮八分钟。', '加入虾仁煮三至四分钟，确认虾仁完全熟透。', '加少许盐调味，盛出后稍放凉再享用。'],
  tip: '虾仁过敏者可换豆腐；以清水代替浓汤底，少油少盐。',
}

const originPoint: Point = { lng: 120.1691, lat: 30.2804 }
const destinations = [
  { match: /西湖/, name: '西湖 · 湖滨音乐喷泉', point: { lng: 120.1648, lat: 30.2538 }, km: 3.2 },
  { match: /杭州东站|火车东站/, name: '杭州东站', point: { lng: 120.2192, lat: 30.2976 }, km: 5.8 },
  { match: /灵隐寺/, name: '灵隐寺', point: { lng: 120.1083, lat: 30.2467 }, km: 8.6 },
]

function contextQuery(request: ChatRequest): string {
  if (!/^(?:请|帮我)?\s*(?:换一家|换一间|换一个|清淡一点|详细步骤|换一种方式|再详细一点|展开说说)[！!。？?\s]*$/.test(request.query.trim())) return request.query
  const previous = [...(request.history ?? [])].reverse().find(message => message.role === 'user'
    && !/^(?:换一家|换一间|换一个|清淡一点|详细步骤|换一种方式)[！!。？?\s]*$/.test(message.content.trim()))
  return `${previous?.content ?? ''} ${request.query}`
}

function makeRoute(request: ChatRequest): { card: RouteCard; known: boolean } {
  const combined = contextQuery(request)
  // Prefer the current turn when it introduces a new destination.
  const destination = destinations.find(item => item.match.test(request.query))
    ?? destinations.find(item => item.match.test(combined))
  const known = destination !== undefined
  const start = known ? originPoint : { lng: 120.16, lat: 30.27 }
  const end = destination?.point ?? { lng: 120.17, lat: 30.28 }
  const km = destination?.km ?? 2
  const modes: RouteMode[] = ['transit', 'walking', 'driving', 'cycling']
  const labels: Record<RouteMode, string> = { walking: '步行', transit: '公共交通', driving: '驾车', cycling: '骑行' }
  const speed: Record<RouteMode, number> = { walking: 4.5, transit: 17, driving: 25, cycling: 13 }
  const offsets: Record<RouteMode, number> = { walking: 0.001, transit: -0.002, driving: 0.003, cycling: -0.001 }
  const options = modes.map(mode => ({
    mode, label: labels[mode], minutes: Math.ceil(km / speed[mode] * 60) + (mode === 'transit' ? 12 : 0),
    distance: `${km.toFixed(1)} 公里（示意）`,
    cost: mode === 'transit' ? '约 ¥4（模拟）' : mode === 'driving' ? `约 ¥${Math.round(km * 3 + 11)}（模拟打车）` : mode === 'cycling' ? '约 ¥3（模拟）' : '¥0',
    steps: mode === 'transit'
      ? ['从示意出发点步行至附近车站', '乘坐往目的地方向的公交／地铁，具体线路请查询实时地图', '下车后步行至目的地；本方案不含实时班次']
      : [`从${known ? '武林广场（模拟起点）' : '示意出发点'}出发`, `沿示意路线${labels[mode]}，注意路况与安全`, `抵达${destination?.name ?? '示意目的地'}；请以实际地图导航为准`],
    points: [
      { ...start },
      { lng: start.lng + (end.lng - start.lng) * 0.32 + offsets[mode], lat: start.lat + (end.lat - start.lat) * 0.28 },
      { lng: start.lng + (end.lng - start.lng) * 0.7, lat: start.lat + (end.lat - start.lat) * 0.72 + offsets[mode] },
      { ...end },
    ],
  }))
  const requestedMode: RouteMode | undefined = /骑行|自行车/.test(request.query) ? 'cycling'
    : /步行|走路/.test(request.query) ? 'walking' : /开车|驾车|打车/.test(request.query) ? 'driving' : undefined
  return {
    known,
    card: {
      type: 'route', origin: known ? '武林广场（模拟出发点）' : '示意出发点（非实际位置）',
      destination: destination?.name ?? '示意目的地（未识别真实地点）', originPoint: { ...start }, destinationPoint: { ...end }, options,
      recommended: requestedMode ?? (/换一种方式/.test(request.query) ? 'cycling' : 'transit'),
    },
  }
}

function chineseNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value)
  const digits: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  if (value.includes('十')) {
    const [tens, units] = value.split('十')
    return (tens ? digits[tens] ?? 0 : 1) * 10 + (units ? digits[units] ?? 0 : 0)
  }
  return digits[value] ?? 0
}

function makeReminder(query: string, now: Date): ReminderCard {
  const local = new Date(now.getTime() + CHINA_OFFSET)
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - CHINA_OFFSET
  let offset = /后天/.test(query) ? 2 : /明天/.test(query) ? 1 : 0
  const weekday = /(?:下周|周|星期)([一二三四五六日天])/.exec(query)
  if (weekday) {
    const target = '日一二三四五六'.indexOf(weekday[1] === '天' ? '日' : weekday[1])
    const current = local.getUTCDay()
    offset = /下周/.test(weekday[0]) ? (7 - ((current + 6) % 7)) + ((target + 6) % 7) : (target - current + 7) % 7
  }
  const clock = /([零一二两三四五六七八九十\d]{1,3})(?:点|时)(?:(半|一刻|三刻)|([零一二两三四五六七八九十\d]{1,3})分?)?|([01]?\d|2[0-3]):([0-5]\d)/.exec(query)
  let hour = clock ? chineseNumber(clock[1] ?? clock[4]) : /晚上|今晚/.test(query) ? 19 : /下午/.test(query) ? 15 : 9
  const minute = clock?.[2] === '半' ? 30 : clock?.[2] === '一刻' ? 15 : clock?.[2] === '三刻' ? 45 : clock?.[3] ? chineseNumber(clock[3]) : Number(clock?.[5] ?? 0)
  if (/下午|晚上|今晚|傍晚/.test(query) && hour < 12) hour += 12
  if (/凌晨|午夜/.test(query) && hour === 12) hour = 0
  hour = Math.min(23, Math.max(0, hour))
  let timestamp = midnight + offset * DAY + hour * HOUR + Math.min(59, minute) * 60_000
  const relative = /([零一二两三四五六七八九十\d]+)\s*(分钟|小时)后/.exec(query)
  if (relative) timestamp = now.getTime() + Math.max(1, chineseNumber(relative[1])) * (relative[2] === '小时' ? HOUR : 60_000)
  if (/半(?:个)?小时后/.test(query)) timestamp = now.getTime() + HOUR / 2
  const shifted = timestamp <= now.getTime()
  if (shifted) timestamp += DAY
  const title = query.replace(/^(?:请|帮我|请帮我)?(?:设置)?提醒(?:我)?/, '')
    .replace(/今天|明天|后天|今晚|(?:下周|周|星期)[一二三四五六日天]|早上|上午|中午|下午|晚上|傍晚|凌晨|午夜/g, '')
    .replace(/([零一二两三四五六七八九十\d]{1,3})(?:点|时)(?:(?:半|一刻|三刻)|[零一二两三四五六七八九十\d]{1,3}分?)?|(?:[01]?\d|2[0-3]):[0-5]\d|[零一二两三四五六七八九十\d]+\s*(?:分钟|小时)后/g, '').trim()
  return {
    type: 'reminder', id: `reminder-${timestamp}-${encodeURIComponent(title)}`, title: title || '待办提醒', dueAt: new Date(timestamp).toISOString(),
    note: `${shifted ? '所选时间已过，已顺延至次日。' : ''}时间按杭州（北京时间）解析。仅生成提醒建议，确认保存后仍需自行设置系统通知。`,
  }
}

export type MockReply = { intent: Intent; text: string; cards: AgentCard[]; suggestions: string[]; thinking: string; plan: string[] }

const WEEKDAYS = '日一二三四五六'

function makeForecast(city: string, now: Date): ForecastCard {
  const today = new Date(now.getTime() + CHINA_OFFSET).getUTCDay()
  const label = (offset: number): string => offset === 0 ? '今天' : offset === 1 ? '明天' : `周${WEEKDAYS[(today + offset) % 7]}`
  const days = [
    { condition: '多云', low: 17, high: 25, rain: 10, advice: '薄外套配长裤，早晚加一层' },
    { condition: '晴', low: 16, high: 24, rain: 0, advice: '适合散步，注意防晒' },
    { condition: '多云', low: 15, high: 22, rain: 20, advice: '长袖为主，备一件针织衫' },
    { condition: '小雨', low: 14, high: 19, rain: 70, advice: '带伞，穿防水的鞋' },
    { condition: '阴', low: 13, high: 18, rain: 30, advice: '风衣或薄羽绒，注意保暖' },
  ]
  return { type: 'forecast', city, days: days.map((day, offset) => ({ label: label(offset), ...day })), tip: '降雨概率与温度均为模拟，出门前请查看实时预报。' }
}

const itinerary: ItineraryCard = {
  type: 'itinerary', id: 'itinerary-hangzhou-day', title: '杭州一日慢游',
  stops: [
    { time: '09:30', title: '西湖 · 湖滨', detail: '沿湖步行到断桥，走走停停约两小时。', address: '杭州湖滨路一带（示意）', point: { lng: 120.1648, lat: 30.2538 }, route: '从武林广场去西湖怎么走' },
    { time: '12:00', title: '午餐 · 新白鹿湖滨店', detail: '杭帮家常菜，人均约 68 元，饭点可能排队。', address: restaurants[0].address, point: restaurants[0].point },
    { time: '14:00', title: '灵隐寺', detail: '寺内与飞来峰慢慢逛，留出三小时；需另购门票。', address: '杭州灵隐路一带（示意）', point: { lng: 120.1083, lat: 30.2467 }, route: '从武林广场去灵隐寺怎么走' },
    { time: '17:30', title: '回到武林广场', detail: '乘公交或打车返回，晚饭前留出休息时间。', address: '杭州武林广场（示意）', point: { lng: 120.1691, lat: 30.2804 } },
  ],
}

const packingList: ChecklistCard = {
  type: 'checklist', id: 'checklist-packing', title: '出门前，带上这些',
  groups: [
    { name: '证件与电子', items: ['身份证', '手机与充电宝', '乘车码或交通卡'] },
    { name: '衣物', items: ['轻薄外套', '舒适的步行鞋', '换洗衣物（过夜时）'] },
    { name: '随身', items: ['折叠伞', '水杯', '纸巾与湿巾'] },
  ],
}

const groceryList: ChecklistCard = {
  type: 'checklist', id: 'checklist-grocery', title: '这次去买菜',
  groups: [
    { name: '蔬菜', items: ['番茄 2 个', '冬瓜 300 克', '小葱一把'] },
    { name: '蛋与肉', items: ['鸡蛋 6 个', '虾仁 150 克'] },
    { name: '调味', items: ['食用油', '盐'] },
  ],
}

type BaseReply = Omit<MockReply, 'thinking' | 'plan'>

function process(reply: BaseReply): Pick<MockReply, 'thinking' | 'plan'> {
  const card = reply.cards[0]
  if (!card) return { thinking: '', plan: [] }
  switch (card.type) {
    case 'weather': return { thinking: `看${card.city}演示天气：${card.low}–${card.high}°，早晚偏凉，湿度 ${card.humidity}%。按分层、好穿脱来挑衣物。`, plan: [] }
    case 'forecast': return { thinking: '对比未来五天的演示预报，找出降雨概率最高的一天，把带伞提醒放在那天。', plan: [] }
    case 'restaurants': return { thinking: '在演示餐厅里按距离、口味和人均比较，兼顾一人食和清淡的选择。', plan: ['筛选附近的演示餐厅', '比较口味与人均', '整理推荐顺序'] }
    case 'recipe': return { thinking: `选步骤少、食材常见的做法，按 ${card.servings} 人份估算用量。`, plan: [] }
    case 'hotels': return { thinking: '按出行目的比较两家住宿示例：逛西湖看位置，赶高铁看交通。', plan: ['比较位置与交通', '整理价格与评分'] }
    case 'route': return { thinking: `起点按演示设为武林广场，目的地是${card.destination}。比较四种方式的示意时长与费用。`, plan: ['确认起点与目的地', '比较四种出行方式', '整理推荐方案'] }
    case 'places': return { thinking: '只在演示地点中查找，不读取你的实际位置。', plan: [] }
    case 'reminder': return { thinking: '按北京时间解析日期和时刻，确认是将来的时间。', plan: [] }
    case 'home': return { thinking: '把居家打理拆成十分钟内能完成的小任务。', plan: [] }
    case 'itinerary': return { thinking: '上午湖边、中午吃饭、下午去寺里，按顺路排列，避免来回折返。', plan: ['挑选顺路的地点', '安排时间与用餐', '核对可查看的路线'] }
    case 'checklist': return { thinking: '按场景分组，把容易忘的小东西补上。', plan: ['按场景分组', '补全容易遗漏的物品'] }
    default: return exhaustive(card)
  }
}

function exhaustive(value: never): never { throw new Error(`未支持的卡片类型：${String(value)}`) }

export function createMockReply(request: ChatRequest, now = new Date()): MockReply {
  const reply = baseReply(request, now)
  return { ...reply, ...process(reply) }
}

function baseReply(request: ChatRequest, now: Date): BaseReply {
  const intent = detectIntent(request.query, request.history)
  const city = request.city.trim() || '杭州'
  const combined = contextQuery(request)
  if (['weather_outfit', 'food_recommend', 'hotel_recommend', 'nearby_search', 'route_plan', 'day_plan'].includes(intent)
    && /北京|上海|深圳|广州|成都|重庆|南京|苏州|宁波|东京|纽约|巴黎/.test(request.query)) {
    return { intent, text: '目前仅提供杭州的生活演示，不会把其他城市的问题套用到杭州。你可以看看杭州示例，真实信息请在地图或天气应用中确认。', cards: [], suggestions: ['今天杭州穿什么', '推荐杭州午餐', '从武林广场去西湖怎么走'] }
  }
  switch (intent) {
    case 'weather_outfit': {
      if (/周末|这周|本周|未来|几天|三天|五天|一周|下周/.test(request.query) && !/今天|明天/.test(request.query)) {
        const card = makeForecast(city, now)
        const rainy = card.days.reduce((wettest, day) => day.rain > wettest.rain ? day : wettest)
        return { intent, text: `未来五天${city}整体偏凉，${rainy.label}有小雨，记得带伞；其余几天适合出门走走。下面是演示预报，出门前请确认实时天气。`, cards: [card], suggestions: [`提醒我${rainy.label}早上八点带伞`, '周末去哪玩', '出门要带什么'] }
      }
      const card: WeatherCard = {
        type: 'weather', city, temperature: 22, condition: '多云', low: 17, high: 25, feelsLike: 23, humidity: 65, wind: '东南风 2 级',
        outfit: ['棉质上衣', '轻薄外套', '舒适长裤', '步行友好的鞋'], tip: '早晚温差稍大，带一把折叠伞会更安心；以下天气为模拟参考。',
        hourly: [{ time: '08:00', temperature: 18, condition: '多云' }, { time: '11:00', temperature: 22, condition: '晴间多云' }, { time: '14:00', temperature: 25, condition: '多云' }, { time: '17:00', temperature: 23, condition: '多云' }, { time: '20:00', temperature: 19, condition: '多云' }],
      }
      return { intent, text: `${/明天/.test(request.query) ? '明天' : '今天'}可以考虑轻薄上衣配长裤，再带一件方便穿脱的外套。${city}早晚偏凉，舒适的鞋也很重要。下面是演示天气，出门前请确认实时预报。`, cards: [card], suggestions: ['适合去哪里散步', '推荐一顿清淡午餐', '提醒我带伞'] }
    }
    case 'food_recommend': {
      const light = /清淡|少油|素食/.test(request.query)
      const items = light ? [restaurants[1], restaurants[2], restaurants[0]] : /换一家/.test(request.query) ? [restaurants[2], restaurants[0], restaurants[1]] : [...restaurants]
      return { intent, text: `这一餐，给你三种选择：家常菜、蔬食和热汤面。${light ? '清淡的选择放在前面，可以备注少盐、酱汁另放。' : '一人吃或赶时间，就选一碗热汤面。'}${/换一家/.test(request.query) ? '当前只有这三家演示餐厅，本次仅调整顺序，没有查询新门店。' : ''}门店与价格均为示例，出发前记得核对地址。`, cards: [{ type: 'restaurants', title: light ? '清淡一点，也好好吃饭' : '把这一餐吃得舒服', items }], suggestions: ['清淡一点', '番茄炒蛋怎么做', '去西湖怎么走'] }
    }
    case 'recipe': {
      const latestRecipe = [...(request.history ?? []).filter(item => item.role === 'user').map(item => item.content), request.query]
        .filter(query => /清淡一点|冬瓜|虾仁|番茄/.test(query)).at(-1) ?? ''
      const card = /清淡一点|冬瓜|虾仁/.test(latestRecipe) ? lightRecipe : tomatoRecipe
      return { intent, text: `做一道${card.name}吧，约 ${card.minutes} 分钟，适合两个人。先准备食材，再开火。步骤可以展开看，也能把食材加入清单；有过敏或忌口请先替换。`, cards: [structuredClone(card)], suggestions: ['详细步骤', '清淡一点', '提醒我明天买食材'] }
    }
    case 'hotel_recommend':
      return { intent, text: '想慢慢逛西湖，看看湖滨小住；次日赶高铁，城东更省心。当前仅有这两家住宿示例，换一家只调整现有示例顺序，没有查询新酒店、真实价格或房态，也不会替你预订。', cards: [{ type: 'hotels', title: '住得舒服，行程从容', items: /换一家/.test(request.query) ? [hotels[1], hotels[0]] : [...hotels] }], suggestions: ['去西湖怎么走', '附近有什么好吃的'] }
    case 'route_plan': {
      const requestedOrigin = /从(.+?)(?:到|去)/.exec(request.query)?.[1]
      if (requestedOrigin && !requestedOrigin.includes('武林广场')) {
        return { intent, text: '目前路线演示从杭州武林广场出发，不能替换成你指定的真实起点。要看这里到西湖的示例吗？真实路线请在百度地图确认。', cards: [], suggestions: ['从武林广场去西湖怎么走', '从武林广场去杭州东站怎么走'] }
      }
      const { card, known } = makeRoute(request)
      if (!known) return { intent, text: '还不能确认你说的是哪个目的地，因此不生成猜测的路线。当前支持从武林广场到西湖、杭州东站或灵隐寺的演示，其他地点请在百度地图查询。', cards: [], suggestions: ['从武林广场去西湖怎么走', '去杭州东站', '去灵隐寺怎么走'] }
      return { intent, text: `从演示起点武林广场到${card.destination}，可以比较四种出行方式。${/换一种方式/.test(request.query) ? '这次优先看看骑行。' : '公共交通比较省心，步行适合不赶时间。'}线路、时长与费用均为示意，真实导航请打开百度地图。`, cards: [card], suggestions: ['换一种方式', '去杭州东站', '去灵隐寺怎么走'] }
    }
    case 'nearby_search': {
      const coffee = /咖啡/.test(combined)
      const items = coffee
        ? [{ id: 'place-coffee-1', name: '街角咖啡', category: '咖啡店', distance: '400 米', address: '杭州武林商圈（示意）', point: { lng: 120.1714, lat: 30.2792 } }, { id: 'place-coffee-2', name: '树下咖啡', category: '咖啡店', distance: '750 米', address: '杭州凤起路一带（示意）', point: { lng: 120.1702, lat: 30.2721 } }]
        : [{ id: 'place-1', name: '街角便利店', category: '便利店', distance: '200 米', address: '杭州武林商圈（示意）', point: { lng: 120.17, lat: 30.2811 } }, { id: 'place-2', name: '社区药房', category: '药店', distance: '450 米', address: '杭州武林路一带（示意）', point: { lng: 120.1664, lat: 30.2787 } }, { id: 'place-3', name: '口袋花园', category: '公园', distance: '650 米', address: '杭州凤起路一带（示意）', point: { lng: 120.1704, lat: 30.2743 } }]
      return { intent, text: `给你几处${coffee ? '可以坐下来读书的咖啡小店' : '日常用得上的便利去处'}。当前只展示这些杭州演示地点，换一家仅调整示例顺序，不会扩大搜索。没有读取你的位置或查询营业状态，出发前请在地图中核对。`, cards: [{ type: 'places', title: coffee ? '附近的咖啡时光' : '顺路发现小方便', items: /换一家/.test(request.query) ? [...items].reverse() : items }], suggestions: ['附近有什么好吃的', '去西湖怎么走'] }
    }
    case 'reminder': {
      if (/每天|每周|每月|重复/.test(request.query)) return { intent, text: '本期只整理一次性事项，暂不支持重复提醒。告诉我一次具体日期和时间，我可以生成待确认的本地清单条目。', cards: [], suggestions: ['提醒我明天早上八点带伞', '提醒我后天上午九点买菜'] }
      if (!/(?:点|时|\d:\d|分钟后)/.test(request.query)) return { intent, text: '想把这件小事记在哪个时间？请补充日期和时间，例如“明天早上八点带伞”。我只会加入本地清单，不会发送到点通知。', cards: [], suggestions: ['提醒我明天早上八点带伞', '提醒我明天晚上七点取快递'] }
      const card = makeReminder(request.query, now)
      const displayTime = new Date(new Date(card.dueAt).getTime() + CHINA_OFFSET).toISOString().slice(0, 16).replace('T', ' ')
      return { intent, text: `“${card.title}”的时间是北京时间 ${displayTime}。核对后可以加入本地清单；这里不会创建系统闹钟或发送到点通知。`, cards: [card], suggestions: ['提醒我后天上午九点买菜', '明天穿什么', '推荐一道简单菜'] }
    }
    case 'home_care':
      return { intent, text: '不必一次整理整个家。从桌面开始，做十分钟就休息一下。选一件小任务加入清单，让家慢慢变舒服；清洁用品按标签使用，不要混合。', cards: [{ type: 'home', title: '十分钟，让家轻一点', tasks: [{ title: '清理桌面', detail: '留下常用的三件物品，其余按用途归位。' }, { title: '通风与擦拭', detail: '空气状况合适时短暂通风，再用微湿软布擦桌面。' }, { title: '看看绿植', detail: '摸一摸表层土壤，干了再浇水；积水及时倒掉。' }] }], suggestions: ['提醒我明天浇花', '推荐一道简单菜', '明天穿什么'] }
    case 'day_plan': {
      const again = /换一[个份家]/.test(request.query)
      return { intent, text: `${again ? '目前只有这一份演示行程，没有生成新的安排。' : ''}给你排了一份不赶的杭州一日慢游：上午湖边散步，中午在湖滨吃饭，下午去灵隐寺。每一站都能看位置，路线以武林广场为演示起点。时间与距离为示意，门票和开放时间请出发前确认。`, cards: [structuredClone(itinerary)], suggestions: ['出门要带什么', '这周天气怎么样', '去灵隐寺怎么走'] }
    }
    case 'checklist': {
      const grocery = /买菜|采购|购物|食材|超市/.test(combined)
      const card = structuredClone(grocery ? groceryList : packingList)
      const count = card.groups.reduce((total, group) => total + group.items.length, 0)
      return { intent, text: grocery
        ? `按番茄炒蛋和冬瓜虾仁汤两道家常菜列了 ${count} 样，可以在卡片里逐项勾掉，也能整份加入本地清单。家里已有的就跳过。`
        : `按证件、衣物、随身三类列了 ${count} 样，出门前逐项勾一遍就不容易落下。过夜再加换洗衣物，下雨记得带伞。`,
      cards: [card], suggestions: grocery ? ['番茄炒蛋怎么做', '提醒我明天上午十点买菜'] : ['这周天气怎么样', '周末去哪玩', '去杭州东站怎么走'] }
    }
    case 'chitchat':
      return { intent, text: '我是 Lumi，帮你把穿搭、吃饭、居家和出行的小事理顺。本期使用杭州演示数据，不提供交易或系统通知。想先从哪件小事开始？', cards: [], suggestions: ['明天穿什么', '推荐一顿午餐', '去西湖怎么走'] }
  }
}
