import { useId, useState, type ReactNode } from 'react'
import {
  ArrowRight, Backpack, BedDouble, Bike, Bookmark, Check, ChevronDown, ChevronUp,
  Clock3, Cloud, CloudRain, CloudSnow, CloudSun, CookingPot, Droplets, Footprints,
  House, Layers, Leaf, ListChecks, ListPlus, MapPin, Navigation, Route, Shirt, Star, Sun,
  Timer, TrainFront, Umbrella, Utensils, Users, Wind, Car, Bell, CalendarDays,
} from 'lucide-react'
import type {
  AgentCard, ChecklistCard, ForecastCard, HomeCard, HotelsCard, ItineraryCard, PlacesCard, Point,
  RecipeCard, ReminderCard, RestaurantsCard, RouteCard, RouteMode, SavedItem, WeatherCard,
} from '../../api/types'
import { useApp } from '../../store/AppStore'
import { Button, Chip, Card, Modal, type ButtonProps } from '../../ui'
import { BaiduMap } from '../map/BaiduMap'
import styles from './cards.module.css'

export type CardViewState = {
  expanded?: boolean
  mode?: RouteMode
  priceSorted?: boolean
  checked?: string[]
}

export type CardRendererProps = {
  card: AgentCard
  onSend: (query: string) => void
  onNotify: (text: string) => void
  viewState?: CardViewState
  onInteract?: () => void
  busy?: boolean
}
type Send = CardRendererProps['onSend']
type Notify = CardRendererProps['onNotify']
type ReadingProps = Pick<CardRendererProps, 'viewState' | 'onInteract'>
type LocalItem = Omit<SavedItem, 'done' | 'createdAt'>
type Location = { name: string; address: string; point: Point }

function CardFrame({ title, icon, children }: {
  title: string; icon: ReactNode; children: ReactNode
}) {
  return <Card className={styles.card}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <span className={styles.headerIcon} aria-hidden="true">{icon}</span>
        <h3>{title}</h3>
      </div>
      <span className={styles.demo}>演示数据</span>
    </header>
    {children}
  </Card>
}

function Action({ variant = 'secondary', className, ...props }: ButtonProps) {
  const classes = [styles.action, variant === 'secondary' && styles.soft, variant === 'ghost' && styles.ghost, className].filter(Boolean).join(' ')
  return <Button {...props} size="sm" variant={variant} className={classes} />
}

function SaveAction({ item, onNotify, label = '收藏', savedLabel = '已收藏', list = false, variant = 'secondary' }: {
  item: LocalItem; onNotify: Notify; label?: string; savedLabel?: string; list?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
}) {
  const { state, dispatch } = useApp()
  const existing = state.saved.find(saved => saved.id === item.id)
  const toggle = () => {
    if (existing) {
      dispatch({ type: 'remove', id: existing.id })
      onNotify(`已从本地清单移除「${item.title}」`)
    } else {
      dispatch({ type: 'save', item: { ...item, done: false, createdAt: new Date().toISOString() } })
      onNotify(`已${list ? '加入' : '收藏到'}本地清单：${item.title}`)
    }
  }
  const Icon = existing ? Check : list ? ListPlus : Bookmark
  return <Action variant={existing ? 'secondary' : variant} onClick={toggle}
    aria-pressed={Boolean(existing)} aria-label={`${existing ? `撤销${savedLabel}` : label}：${item.title}`}
    title={existing ? '点击从本地清单移除' : '保存到本地清单'}>
    <Icon aria-hidden="true" />{existing ? savedLabel : label}
  </Action>
}

function LocationModal({ location, onClose }: { location: Location | null; onClose: () => void }) {
  return <Modal open={Boolean(location)} onClose={onClose} title={location ? `${location.name}的位置` : '查看位置'}>
    {location && <div className={styles.locationContent}>
      <p className={styles.address}><MapPin size={15} aria-hidden="true" />{location.address}</p>
      <BaiduMap title={location.name} markers={[{ point: location.point, label: location.name, kind: 'place' }]} />
      <p className={styles.finePrint}>演示位置为 BD-09 近似点位，请以商家实际地址为准。</p>
    </div>}
  </Modal>
}

function WeatherSymbol({ condition, size = 24 }: { condition: string; size?: number }) {
  const Icon = /雪/.test(condition) ? CloudSnow : /雨|雷/.test(condition) ? CloudRain
    : /阴|雾|霾/.test(condition) ? Cloud : /云/.test(condition) ? CloudSun : Sun
  return <Icon size={size} strokeWidth={1.5} aria-hidden="true" />
}

function WeatherView({ card, onSend, busy }: { card: WeatherCard; onSend: Send; busy: boolean }) {
  const outfitIcons = [Shirt, Layers, Backpack]
  return <CardFrame title={`${card.city} · 天气与穿搭`} icon={<CloudSun />}>
    <div className={styles.weatherHero}>
      <div><div className={styles.temperature}>{card.temperature}<span>°</span></div>
        <p className={styles.weatherCondition}>{card.condition}<span>{card.low}° / {card.high}°</span></p>
      </div>
      <div className={styles.weatherArt}><WeatherSymbol condition={card.condition} size={56} /></div>
    </div>
    <div className={styles.weatherMeta}>
      <span><Timer size={14} aria-hidden="true" />体感 {card.feelsLike}°</span>
      <span><Droplets size={14} aria-hidden="true" />湿度 {card.humidity}%</span>
      <span><Wind size={14} aria-hidden="true" />{card.wind}</span>
    </div>
    {card.hourly.length > 0 && <div className={styles.hourly} aria-label="四个时段的演示预报">
      {card.hourly.slice(0, 4).map((hour, index) => <div key={`${hour.time}-${index}`}>
        <span className={styles.hourTime}>{hour.time}</span>
        <span className={styles.hourIcon} title={hour.condition}><WeatherSymbol condition={hour.condition} size={20} /></span>
        <strong>{hour.temperature}°</strong><span className={styles.hourCondition}>{hour.condition}</span>
      </div>)}
    </div>}
    <div className={styles.sectionHeading}><h4>舒适穿搭建议</h4><span>舒适优先</span></div>
    <ul className={styles.outfits}>
      {card.outfit.slice(0, 3).map((outfit, index) => {
        const Icon = outfitIcons[index]
        return <li key={`${outfit}-${index}`}><Icon size={16} aria-hidden="true" /><span>{outfit}</span></li>
      })}
    </ul>
    {card.tip && <p className={styles.tip}>{card.tip}</p>}
    <div className={styles.footerActions}>
      <Action disabled={busy} onClick={() => onSend(`根据${card.city}今天的天气，帮我搭配一套通勤穿搭`)}><Shirt aria-hidden="true" />通勤怎么穿</Action>
      <Action variant="ghost" disabled={busy} onClick={() => onSend(`根据${card.city}今天的天气，周末户外活动怎么穿、需要带什么？`)}>户外穿搭<ArrowRight aria-hidden="true" /></Action>
    </div>
  </CardFrame>
}

function ForecastView({ card, onSend, busy }: { card: ForecastCard; onSend: Send; busy: boolean }) {
  const rainy = card.days.length ? card.days.reduce((wettest, day) => day.rain > wettest.rain ? day : wettest) : undefined
  const wet = rainy && rainy.rain >= 50 ? rainy : undefined
  return <CardFrame title={`${card.city} · 未来 ${card.days.length} 天`} icon={<CalendarDays />}>
    <ol className={styles.forecast}>
      {card.days.map(day => <li key={day.label} data-rainy={day === wet || undefined}>
        <span className={styles.dayLabel}>{day.label}</span>
        <span className={styles.dayIcon} title={day.condition}><WeatherSymbol condition={day.condition} size={20} /></span>
        <div className={styles.dayBody}><p>{day.condition}</p><p className={styles.dayAdvice}>{day.advice}</p></div>
        <span className={styles.dayRain}><Umbrella size={13} aria-hidden="true" />{day.rain}%<span className={styles.srOnly}>降雨概率</span></span>
        <span className={styles.dayTemp}>{day.low}° / {day.high}°</span>
      </li>)}
    </ol>
    {!card.days.length && <p className={styles.empty}>暂无预报，稍后再试试。</p>}
    {card.tip && <p className={styles.tip}>{card.tip}</p>}
    {wet && <div className={styles.footerActions}>
      <Action disabled={busy} onClick={() => onSend(`提醒我${wet.label}早上八点带伞`)}><Bell aria-hidden="true" />{wet.label}提醒带伞</Action>
      <Action variant="ghost" disabled={busy} onClick={() => onSend(`${wet.label}穿什么`)}>{wet.label}穿什么<ArrowRight aria-hidden="true" /></Action>
    </div>}
  </CardFrame>
}

function RestaurantsView({ card, onNotify, viewState, onInteract }: { card: RestaurantsCard; onNotify: Notify } & ReadingProps) {
  const [location, setLocation] = useState<Location | null>(null)
  const [priceSorted, setPriceSorted] = useState(viewState?.priceSorted ?? false)
  const items = card.items.slice(0, 3)
  if (priceSorted) items.sort((a, b) => a.price - b.price)
  function toggleSort() {
    onInteract?.()
    const next = !priceSorted
    if (viewState) viewState.priceSorted = next
    setPriceSorted(next)
  }
  return <CardFrame title={card.title} icon={<Utensils />}>
    <div className={styles.entityList}>
      {items.map(item => <article key={item.id} className={styles.entityRow}>
        <div className={styles.entityBody}>
          <div className={styles.entityTitle}><h4>{item.name}</h4><span className={styles.rating}><Star size={12} aria-hidden="true" />{item.rating.toFixed(1)}</span></div>
          <p className={styles.entityMeta}>{item.category}<span>人均 ¥{item.price.toLocaleString('zh-CN')}</span></p>
          <p className={styles.distance}><Footprints size={12} aria-hidden="true" />{item.distance} · 步行约 {item.walkMinutes} 分钟</p>
          <p className={styles.tags}>{item.tags.join(' · ')}</p>
          <div className={styles.rowActions}>
            <SaveAction item={{ id: item.id, kind: 'restaurant', title: item.name, detail: `${item.category} · 人均 ¥${item.price} · ${item.address}` }} onNotify={onNotify} />
            <Action variant="ghost" onClick={() => setLocation(item)}><MapPin aria-hidden="true" />看位置</Action>
          </div>
        </div>
      </article>)}
    </div>
    {!card.items.length && <p className={styles.empty}>暂无餐厅，试试换个口味或商圈。</p>}
    <div className={styles.footerActions}>
      <Action disabled={items.length < 2} aria-pressed={priceSorted} onClick={toggleSort}>{priceSorted ? '恢复推荐顺序' : '按价格排序'}</Action>
      <p className={styles.demoScope}>仅比较这三家演示餐厅，不查询新门店</p>
    </div>
    <LocationModal location={location} onClose={() => setLocation(null)} />
  </CardFrame>
}

function RecipeView({ card, onSend, onNotify, viewState, onInteract, busy }: { card: RecipeCard; onSend: Send; onNotify: Notify; busy: boolean } & ReadingProps) {
  const [expanded, setExpanded] = useState(viewState?.expanded ?? false)
  const stepsId = useId()
  function toggleSteps() {
    onInteract?.()
    const next = !expanded
    if (viewState) viewState.expanded = next
    setExpanded(next)
  }
  return <CardFrame title={card.name} icon={<CookingPot />}>
    <div className={styles.recipeMeta}><span><Clock3 size={14} aria-hidden="true" />{card.minutes} 分钟</span><span><Users size={14} aria-hidden="true" />{card.servings} 人份</span><span>{card.difficulty}</span></div>
    <div className={styles.sectionHeading}><h4>准备这些食材</h4><span>{card.ingredients.length} 种</span></div>
    <ul className={styles.ingredients}>{card.ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}><span>{ingredient.name}</span><span>{ingredient.amount}</span></li>)}</ul>
    <div className={styles.footerActions}>
      {card.ingredients.length > 0 ? <SaveAction list variant="primary" label="食材加入清单" savedLabel="食材已加入"
        item={{ id: `recipe:${encodeURIComponent(card.name)}`, kind: 'recipe', title: `${card.name} · 食材清单`, detail: `${card.servings} 人份；${card.ingredients.map(ingredient => `${ingredient.name} ${ingredient.amount}`).join('、')}` }} onNotify={onNotify} />
        : <Action variant="primary" disabled={busy} onClick={() => onSend(`请补充${card.name}的食材和用量`)}>补充食材</Action>}
      {card.steps.length > 0 ? <Action aria-expanded={expanded} aria-controls={stepsId} onClick={toggleSteps}>
        {expanded ? '收起步骤' : `查看步骤 · ${card.steps.length} 步`}{expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </Action> : <Action disabled={busy} onClick={() => onSend(`请告诉我${card.name}的详细做法`)}>询问做法</Action>}
    </div>
    {expanded && <ol id={stepsId} className={styles.steps}>{card.steps.map((step, index) => <li key={`${step}-${index}`}><span className={styles.stepNumber}>{index + 1}</span><p>{step}</p></li>)}</ol>}
    {card.tip && <p className={styles.tip}><Leaf size={14} aria-hidden="true" />{card.tip}</p>}
    <p className={styles.finePrint}>食材保存到本地清单，购买前可按家中余量调整。</p>
  </CardFrame>
}

function HotelsView({ card, onNotify, viewState, onInteract }: { card: HotelsCard; onNotify: Notify } & ReadingProps) {
  const [location, setLocation] = useState<Location | null>(null)
  const [priceSorted, setPriceSorted] = useState(viewState?.priceSorted ?? false)
  const items = card.items.slice(0, 2)
  if (priceSorted) items.sort((a, b) => a.price - b.price)
  function toggleSort() {
    onInteract?.()
    const next = !priceSorted
    if (viewState) viewState.priceSorted = next
    setPriceSorted(next)
  }
  return <CardFrame title={card.title} icon={<BedDouble />}>
    <div className={styles.entityList}>
      {items.map(item => <article key={item.id} className={styles.entityRow}>
        <div className={styles.entityBody}>
          <div className={styles.entityTitle}><h4>{item.name}</h4><span className={styles.rating}><Star size={12} aria-hidden="true" />{item.rating.toFixed(1)}</span></div>
          <p className={styles.entityMeta}>{item.area}</p><p className={styles.description}>{item.description}</p>
          <p className={styles.tags}>{item.tags.join(' · ')}</p>
          <div className={styles.hotelBottom}><p className={styles.price}>¥{item.price.toLocaleString('zh-CN')}<span>/ 晚</span></p>
            <div className={styles.rowActions}>
              <SaveAction item={{ id: item.id, kind: 'hotel', title: item.name, detail: `${item.area} · ¥${item.price}/晚 · ${item.address}` }} onNotify={onNotify} />
              <Action variant="ghost" onClick={() => setLocation(item)}><MapPin aria-hidden="true" />位置</Action>
            </div>
          </div>
        </div>
      </article>)}
    </div>
    {!card.items.length && <p className={styles.empty}>暂无酒店，换个区域或预算试试。</p>}
    <div className={styles.footerActions}>
      <Action disabled={items.length < 2} aria-pressed={priceSorted} onClick={toggleSort}>{priceSorted ? '恢复推荐顺序' : '按价格排序'}</Action>
      <p className={styles.demoScope}>仅比较这两家演示酒店，不查询新酒店</p>
    </div>
    <LocationModal location={location} onClose={() => setLocation(null)} />
  </CardFrame>
}

function ModeIcon({ mode }: { mode: RouteMode }) {
  switch (mode) {
    case 'walking': return <Footprints size={15} aria-hidden="true" />
    case 'transit': return <TrainFront size={15} aria-hidden="true" />
    case 'driving': return <Car size={15} aria-hidden="true" />
    case 'cycling': return <Bike size={15} aria-hidden="true" />
    default: return exhaustive(mode)
  }
}

function RouteView({ card, viewState, onInteract }: { card: RouteCard } & ReadingProps) {
  const [mode, setMode] = useState<RouteMode>(viewState?.mode ?? card.recommended)
  function selectMode(next: RouteMode) {
    onInteract?.()
    if (viewState) viewState.mode = next
    setMode(next)
  }
  const selected = card.options.find(option => option.mode === mode)
    ?? card.options.find(option => option.mode === card.recommended) ?? card.options[0]
  return <CardFrame title="出发，去想去的地方" icon={<Navigation />}>
    <div className={styles.endpoints}><p><span className={styles.originDot} />{card.origin}</p><span className={styles.endpointLine} /><p><span className={styles.destinationDot} />{card.destination}</p></div>
    <div className={styles.routeModes} aria-label="选择出行方案">{card.options.map(option => <Chip key={option.mode} selected={selected?.mode === option.mode} aria-pressed={selected?.mode === option.mode} onClick={() => selectMode(option.mode)}>
      <ModeIcon mode={option.mode} />{option.label}{option.mode === card.recommended && <span className={styles.srOnly}>（推荐）</span>}
    </Chip>)}</div>
    {selected ? <>
      <div className={styles.routeSummary} role="status" aria-live="polite" aria-atomic="true"><div><strong>{selected.minutes}</strong><span>分钟</span></div><p>{selected.distance}<span>{selected.cost}</span></p><span className={styles.routeLabel}>{selected.mode === card.recommended ? '推荐方案' : selected.label}</span></div>
      <ol className={styles.routeSteps}>{selected.steps.map((step, index) => <li key={`${selected.mode}-${index}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
    </> : <p className={styles.empty}>暂无路线方案，地图仅展示起终点。</p>}
    <BaiduMap title={`${card.origin}到${card.destination}`} origin={card.originPoint} destination={card.destinationPoint}
      markers={[{ point: card.originPoint, label: card.origin, kind: 'start' }, { point: card.destinationPoint, label: card.destination, kind: 'end' }]}
      points={selected?.points} mode={selected?.mode ?? card.recommended} />
    <p className={styles.finePrint}>时长、线路与步骤均为演示，不代表实时路况；导航请在百度地图确认。以上为四种演示方案，可直接切换比较。</p>
  </CardFrame>
}

function PlacesView({ card }: { card: PlacesCard }) {
  const [location, setLocation] = useState<Location | null>(null)
  return <CardFrame title={card.title} icon={<MapPin />}>
    <div className={styles.places}>{card.items.map(item => <article className={styles.placeRow} key={item.id}>
      <span className={styles.placeIcon} aria-hidden="true"><MapPin size={18} strokeWidth={1.6} /></span>
      <div className={styles.placeBody}><h4>{item.name}</h4><p>{item.category} · {item.distance}</p><p className={styles.placeAddress}>{item.address}</p></div>
      <Action variant="ghost" aria-label={`查看${item.name}的位置`} onClick={() => setLocation(item)}>位置<ArrowRight aria-hidden="true" /></Action>
    </article>)}</div>
    {!card.items.length && <p className={styles.empty}>暂未找到地点，试试其他关键词。</p>}
    <p className={styles.finePrint}>仅展示当前演示地点。</p>
    <LocationModal location={location} onClose={() => setLocation(null)} />
  </CardFrame>
}

function ItineraryView({ card, onSend, onNotify, busy }: { card: ItineraryCard; onSend: Send; onNotify: Notify; busy: boolean }) {
  const [location, setLocation] = useState<Location | null>(null)
  return <CardFrame title={card.title} icon={<Route />}>
    <ol className={styles.timeline}>{card.stops.map((stop, index) => <li key={`${stop.time}-${index}`}>
      <time className={styles.stopTime}>{stop.time}</time>
      <div className={styles.stopBody}>
        <h4>{stop.title}</h4>
        <p className={styles.description}>{stop.detail}</p>
        <div className={styles.rowActions}>
          <Action variant="ghost" aria-label={`查看${stop.title}的位置`} onClick={() => setLocation({ name: stop.title, address: stop.address, point: stop.point })}><MapPin aria-hidden="true" />看位置</Action>
          {stop.route && <Action variant="ghost" disabled={busy} aria-label={`查看去${stop.title}的路线`} onClick={() => onSend(stop.route!)}><Navigation aria-hidden="true" />看路线</Action>}
        </div>
      </div>
    </li>)}</ol>
    {!card.stops.length && <p className={styles.empty}>暂无安排，告诉 Lumi 你想去哪儿。</p>}
    {card.stops.length > 0 && <div className={styles.footerActions}>
      <SaveAction list variant="primary" label="行程加入清单" savedLabel="行程已加入"
        item={{ id: card.id, kind: 'task', title: card.title, detail: card.stops.map(stop => `${stop.time} ${stop.title}`).join('；') }} onNotify={onNotify} />
    </div>}
    <p className={styles.finePrint}>时间为建议安排，门票与营业时间请以景区公告为准。</p>
    <LocationModal location={location} onClose={() => setLocation(null)} />
  </CardFrame>
}

function ChecklistView({ card, onNotify, viewState, onInteract }: { card: ChecklistCard; onNotify: Notify } & ReadingProps) {
  const [checked, setChecked] = useState<string[]>(viewState?.checked ?? [])
  const total = card.groups.reduce((sum, group) => sum + group.items.length, 0)
  function toggle(key: string) {
    onInteract?.()
    const next = checked.includes(key) ? checked.filter(item => item !== key) : [...checked, key]
    if (viewState) viewState.checked = next
    setChecked(next)
  }
  return <CardFrame title={card.title} icon={<ListChecks />}>
    {card.groups.map((group, groupIndex) => <section key={`${group.name}-${groupIndex}`} className={styles.checkGroup} aria-label={group.name}>
      <h4>{group.name}</h4>
      <ul>{group.items.map(item => {
        const key = `${groupIndex}:${item}`
        const done = checked.includes(key)
        return <li key={key}><label data-checked={done || undefined}>
          <input type="checkbox" checked={done} onChange={() => toggle(key)} />
          <span>{item}</span>
        </label></li>
      })}</ul>
    </section>)}
    {!total && <p className={styles.empty}>清单还是空的。</p>}
    {total > 0 && <div className={styles.footerActions}>
      <SaveAction list variant="primary" label="全部加入清单" savedLabel="已加入清单"
        item={{ id: card.id, kind: 'task', title: card.title, detail: card.groups.flatMap(group => group.items).join('、') }} onNotify={onNotify} />
      <p className={styles.demoScope} aria-live="polite">已备好 {checked.length}/{total}</p>
    </div>}
    <p className={styles.finePrint}>勾选只在这张卡片里记录；加入清单后按整份保存，可在「清单」页标记完成。</p>
  </CardFrame>
}

function ReminderView({ card, onNotify }: { card: ReminderCard; onNotify: Notify }) {
  const date = new Date(card.dueAt)
  const validDate = Number.isFinite(date.getTime())
  const due = validDate ? new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai',
  }).format(date) : card.dueAt
  return <CardFrame title={card.title} icon={<Bell />}>
    <div className={styles.reminderTime}><Clock3 size={18} aria-hidden="true" /><div><time dateTime={validDate ? card.dueAt : undefined}>{due || '未指定时间'}</time><span>北京时间 · 本地清单</span></div></div>
    {card.note && <p className={styles.reminderNote}>{card.note}</p>}
    <div className={styles.footerActions}><SaveAction list variant="primary" label="加入本地清单" savedLabel="已加入清单"
      item={{ id: card.id, kind: 'reminder', title: card.title, detail: card.note, ...(validDate ? { dueAt: card.dueAt } : {}) }} onNotify={onNotify} /></div>
    <p className={styles.finePrint}>仅保存到本地清单，不会设置系统通知或后台闹钟。再次点击可撤销。</p>
  </CardFrame>
}

function HomeView({ card, onSend, onNotify, busy }: { card: HomeCard; onSend: Send; onNotify: Notify; busy: boolean }) {
  return <CardFrame title={card.title} icon={<House />}>
    <div className={styles.tasks}>{card.tasks.map((task, index) => <article key={`${task.title}-${index}`} className={styles.taskRow}>
      <span className={styles.taskIndex}>{String(index + 1).padStart(2, '0')}</span>
      <div className={styles.taskBody}><h4>{task.title}</h4><p>{task.detail}</p>
        <SaveAction list label="加入任务" savedLabel="已加入清单" item={{ id: `task:${encodeURIComponent(card.title)}:${encodeURIComponent(task.title)}`, kind: 'task', title: task.title, detail: task.detail }} onNotify={onNotify} />
      </div>
    </article>)}</div>
    {!card.tasks.length && <p className={styles.empty}>暂无任务，可以请 Lumi 帮你安排。</p>}
    <div className={styles.footerActions}><Action variant="ghost" disabled={busy} onClick={() => onSend(`关于${card.title}，帮我安排一个更轻松的居家打理计划`)}>帮我安排轻松一点<ArrowRight aria-hidden="true" /></Action></div>
    <p className={styles.finePrint}>任务保存在本地清单，可在清单中标记完成。</p>
  </CardFrame>
}

function exhaustive(value: never): never { throw new Error(`未支持的卡片类型：${String(value)}`) }

export function CardRenderer({ card, onSend, onNotify, viewState, onInteract, busy = false }: CardRendererProps) {
  switch (card.type) {
    case 'weather': return <WeatherView card={card} onSend={onSend} busy={busy} />
    case 'forecast': return <ForecastView card={card} onSend={onSend} busy={busy} />
    case 'restaurants': return <RestaurantsView card={card} onNotify={onNotify} viewState={viewState} onInteract={onInteract} />
    case 'recipe': return <RecipeView card={card} onSend={onSend} onNotify={onNotify} viewState={viewState} onInteract={onInteract} busy={busy} />
    case 'hotels': return <HotelsView card={card} onNotify={onNotify} viewState={viewState} onInteract={onInteract} />
    case 'route': return <RouteView card={card} viewState={viewState} onInteract={onInteract} />
    case 'places': return <PlacesView card={card} />
    case 'itinerary': return <ItineraryView card={card} onSend={onSend} onNotify={onNotify} busy={busy} />
    case 'checklist': return <ChecklistView card={card} onNotify={onNotify} viewState={viewState} onInteract={onInteract} />
    case 'reminder': return <ReminderView card={card} onNotify={onNotify} />
    case 'home': return <HomeView card={card} onSend={onSend} onNotify={onNotify} busy={busy} />
    default: return exhaustive(card)
  }
}
