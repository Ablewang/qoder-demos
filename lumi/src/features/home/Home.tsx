import { useEffect, useState } from 'react'
import { Bell, ChefHat, ChevronRight, Coffee, House, MapPin, Shirt, Sun } from 'lucide-react'
import { getHomeOverview } from '../../api/client'
import type { HomeOverview } from '../../api/types'
import { Badge, Button, Skeleton } from '../../ui'
import styles from './home.module.css'

const scenes = [
  { icon: Shirt, title: '穿搭', detail: '天气与衣服', query: '今天杭州天气怎么样，适合穿什么？' },
  { icon: ChefHat, title: '吃饭', detail: '附近的餐厅', query: '推荐几家附近适合午饭的餐厅' },
  { icon: House, title: '住宿', detail: '周末住一晚', query: '周末想在西湖附近住一晚，有什么推荐？' },
  { icon: MapPin, title: '出行', detail: '路线与交通', query: '从武林广场去西湖，怎么走比较方便？' },
]
const examples = [
  { icon: Coffee, title: '找一家安静的咖啡馆', query: '附近有适合看书的安静咖啡馆吗？' },
  { icon: ChefHat, title: '20 分钟做一道菜', query: '教我做一道20分钟能完成的番茄炒蛋' },
  { icon: Bell, title: '记下明晚取快递', query: '提醒我明天晚上七点取快递' },
]
export function Home({ onSend }: { onSend: (query: string) => void }) {
  const [overview, setOverview] = useState<HomeOverview | null>(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError('')
    getHomeOverview(controller.signal).then(setOverview).catch(e => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '今日概览暂时无法加载。')
    })
    return () => controller.abort()
  }, [reload])
  return <div className={styles.home}>
    <header className={styles.heading}>
      <h1>今天</h1><p>{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
    </header>
    <section className={styles.weather} aria-label="今日生活概览">
      {error ? <div className={styles.overviewError}><p>{error}</p><Button size="sm" variant="secondary" onClick={() => setReload(r => r + 1)}>重新加载</Button></div>
        : overview ? <>
          <div className={styles.weatherTop}><span className={styles.weatherCity}>{overview.city}</span><Badge>演示天气</Badge></div>
          <div className={styles.weatherMain}>
            <Sun className={styles.sun} size={28} strokeWidth={1.5} aria-hidden="true" />
            <div className={styles.temperature}>{overview.temperature}<span>°</span></div>
            <div className={styles.weatherMeta}><strong>{overview.condition}</strong><span>{overview.low}° / {overview.high}° · 空气{overview.airQuality}</span></div>
          </div>
          <button className={styles.outfitButton} onClick={() => onSend('今天杭州天气怎么样，适合穿什么？')}>查看穿搭<ChevronRight size={16} aria-hidden="true" /></button>
        </> : <div className={styles.loading}><Skeleton style={{ width: '30%', height: 14 }} /><Skeleton style={{ width: '65%', height: 44 }} /></div>}
    </section>

    <section className={styles.scenes} aria-label="生活分类">
      <div className={styles.sectionTitle}><h2>生活</h2></div>
      <div className={styles.sceneGrid}>{scenes.map(scene => <button key={scene.title} className={styles.scene} aria-label={scene.title} onClick={() => onSend(scene.query)}>
        <scene.icon className={styles.sceneIcon} size={22} strokeWidth={1.6} aria-hidden="true" />
        <div><h3>{scene.title}</h3><p>{scene.detail}</p></div>
      </button>)}</div>
    </section>

    <section className={styles.inspiration}>
      <div className={styles.sectionTitle}><h2>常用问题</h2></div>
      <div className={styles.exampleList}>{examples.map(example => <button key={example.title} className={styles.example} onClick={() => onSend(example.query)}><example.icon size={18} strokeWidth={1.6} aria-hidden="true" /><span>{example.title}</span><ChevronRight size={16} aria-hidden="true" /></button>)}</div>
    </section>
  </div>
}
