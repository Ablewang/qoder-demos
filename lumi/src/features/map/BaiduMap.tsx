import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Layers, MapPin } from 'lucide-react'
import type { Point, RouteMode } from '../../api/types'
import { Button, Spinner } from '../../ui'
import {
  createBaiduDirectionUrl, createBaiduMarkerUrl, getBaiduMapKey, isValidBaiduPoint, loadBaiduMap,
  type BaiduMapInstance, type BaiduMapSDK,
} from '../../lib/baidu'
import styles from './map.module.css'

export type BaiduMapMarker = { point: Point; label: string; kind?: 'start' | 'end' | 'place' }
export type BaiduMapProps = {
  markers?: readonly BaiduMapMarker[]
  points?: readonly Point[]
  origin?: Point
  destination?: Point
  mode?: RouteMode
  title?: string
  className?: string
}
const EMPTY_MARKERS: readonly BaiduMapMarker[] = []
const EMPTY_POINTS: readonly Point[] = []
const HANGZHOU: Point = { lng: 120.1618, lat: 30.2575 }

function samePoint(a: Point, b: Point): boolean { return a.lng === b.lng && a.lat === b.lat }

function SchematicMap({ markers, points, title }: {
  markers: readonly BaiduMapMarker[]; points: readonly Point[]; title: string
}) {
  const all = [...markers.map(marker => marker.point), ...points]
  const minLng = Math.min(...all.map(point => point.lng))
  const maxLng = Math.max(...all.map(point => point.lng))
  const minLat = Math.min(...all.map(point => point.lat))
  const maxLat = Math.max(...all.map(point => point.lat))
  const project = (point: Point) => ({
    x: maxLng === minLng ? 280 : 70 + (point.lng - minLng) / (maxLng - minLng) * 420,
    y: maxLat === minLat ? 140 : 65 + (maxLat - point.lat) / (maxLat - minLat) * 150,
  })
  const path = points.map((point, index) => {
    const { x, y } = project(point)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className={styles.schematic} viewBox="0 0 560 280" role="img" aria-label={`${title}，街区与路线仅为示意`}>
      <rect width="560" height="280" className={styles.mapGround} />
      <g className={styles.blocks}>
        <rect x="18" y="18" width="100" height="65" rx="12" />
        <rect x="138" y="18" width="75" height="65" rx="10" />
        <rect x="237" y="18" width="115" height="65" rx="12" />
        <rect x="375" y="18" width="68" height="65" rx="10" />
        <rect x="465" y="18" width="78" height="65" rx="10" />
        <rect x="18" y="105" width="78" height="65" rx="10" />
        <rect x="118" y="105" width="96" height="65" rx="12" />
        <rect x="238" y="105" width="114" height="65" rx="12" />
        <rect x="376" y="105" width="165" height="65" rx="12" />
        <rect x="18" y="194" width="100" height="68" rx="12" />
        <rect x="140" y="194" width="74" height="68" rx="10" />
        <rect x="238" y="194" width="114" height="68" rx="12" />
        <rect x="376" y="194" width="165" height="68" rx="12" />
      </g>
      <g className={styles.park}>
        <rect x="240" y="22" width="108" height="57" rx="12" />
        <circle cx="264" cy="42" r="9" /><circle cx="293" cy="52" r="12" /><circle cx="322" cy="39" r="8" />
      </g>
      <path d="M 404 -20 C 345 50 458 85 416 146 S 413 237 482 300" className={styles.riverBank} />
      <path d="M 404 -20 C 345 50 458 85 416 146 S 413 237 482 300" className={styles.river} />
      <path d="M 0 94 H 560 M 0 182 H 560 M 226 0 V 280" className={styles.roads} />
      <text x="30" y="96" className={styles.streetLabel}>生活街区</text>
      <text x="253" y="76" className={styles.streetLabel}>街心公园</text>
      {points.length > 1 && <><path d={path} className={styles.routeHalo} /><path d={path} className={styles.routeLine} /></>}
      {markers.map((marker, index) => {
        const { x, y } = project(marker.point)
        const label = marker.kind === 'start' ? '起' : marker.kind === 'end' ? '终' : String(index + 1)
        return <g key={`${marker.label}-${index}`} transform={`translate(${x}, ${y})`}>
          <circle r="20" className={styles.pinHalo} />
          <circle r="14" className={marker.kind === 'end' ? styles.endPin : styles.startPin} />
          <text textAnchor="middle" dy=".35em" className={styles.pinText}>{label}</text>
        </g>
      })}
    </svg>
  )
}

export function BaiduMap({
  markers = EMPTY_MARKERS, points = EMPTY_POINTS, origin, destination, mode = 'walking',
  title = '位置示意', className,
}: BaiduMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<BaiduMapInstance | null>(null)
  const mounted = useRef(false)
  const [runtime, setRuntime] = useState<{ api: BaiduMapSDK } | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const hasKey = Boolean(getBaiduMapKey())

  const geometry = useMemo(() => {
    const pins = markers.filter(marker => isValidBaiduPoint(marker.point))
    if (origin && isValidBaiduPoint(origin) && !pins.some(marker => samePoint(marker.point, origin))) {
      pins.unshift({ point: origin, label: '起点', kind: 'start' })
    }
    if (destination && isValidBaiduPoint(destination) && !pins.some(marker => samePoint(marker.point, destination))) {
      pins.push({ point: destination, label: '终点', kind: 'end' })
    }
    if (!pins.length) pins.push({ point: HANGZHOU, label: title, kind: 'place' })
    const line = [
      ...(origin && isValidBaiduPoint(origin) ? [origin] : []),
      ...points.filter(isValidBaiduPoint),
      ...(destination && isValidBaiduPoint(destination) ? [destination] : []),
    ].filter((point, index, list) => index === 0 || !samePoint(point, list[index - 1]))
    return { pins, line }
  }, [markers, points, origin, destination, title])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (!runtime || !containerRef.current) return
    let map: BaiduMapInstance | undefined
    let observer: ResizeObserver | undefined
    const resize = () => {
      if (map?.checkResize) map.checkResize()
      else map?.resize?.()
    }
    try {
      const { api } = runtime
      map = new api.Map(containerRef.current, { enableAutoResize: true })
      map.centerAndZoom(new api.Point(HANGZHOU.lng, HANGZHOU.lat), 15)
      map.enableScrollWheelZoom(false)
      mapRef.current = map
      window.addEventListener('resize', resize)
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize)
        observer.observe(containerRef.current)
      }
      setStatus('ready')
    } catch {
      setError('百度底图初始化失败，已保留路线示意。')
      setStatus('error')
    }
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      mapRef.current = null
      try { map?.destroy() } catch { /* A partially initialized SDK may already be destroyed. */ }
    }
  }, [runtime])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !runtime) return
    const { api } = runtime
    const toPoint = (point: Point) => new api.Point(point.lng, point.lat)
    try {
      map.clearOverlays()
      geometry.pins.forEach(marker => map.addOverlay(new api.Marker(toPoint(marker.point))))
      if (geometry.line.length > 1) {
        const primary = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#526b50'
        map.addOverlay(new api.Polyline(geometry.line.map(toPoint), {
          strokeColor: primary, strokeWeight: 5, strokeOpacity: 0.9,
        }))
      }
      const viewport = [...geometry.pins.map(marker => toPoint(marker.point)), ...geometry.line.map(toPoint)]
      if (viewport.length === 1) map.centerAndZoom(viewport[0], 16)
      else map.setViewport(viewport, { margins: [42, 42, 42, 42] })
    } catch {
      setError('地图绘制失败，已切换到路线示意。')
      setStatus('error')
    }
  }, [runtime, geometry])

  const enableMap = () => {
    if (status === 'loading') return
    setStatus('loading')
    setError('')
    void loadBaiduMap().then(api => {
      if (mounted.current) setRuntime({ api })
    }).catch(() => {
      if (!mounted.current) return
      setError('百度底图加载失败，请检查网络或 AK；示意地图仍可使用。')
      setStatus('error')
    })
  }

  const isRoute = Boolean(origin && destination && isValidBaiduPoint(origin) && isValidBaiduPoint(destination))
  const href = isRoute && origin && destination
    ? createBaiduDirectionUrl({ origin, destination, mode })
    : createBaiduMarkerUrl({ point: geometry.pins[0].point, title: geometry.pins[0].label })

  return <section className={[styles.map, className].filter(Boolean).join(' ')} aria-label={title}>
    <div className={styles.canvas}>
      <div ref={containerRef} className={styles.liveMap} data-ready={status === 'ready'} data-sheet-nodrag={status === 'ready' ? '' : undefined} aria-hidden={status !== 'ready'} />
      {status !== 'ready' && <SchematicMap markers={geometry.pins} points={geometry.line} title={title} />}
      <span className={styles.mapTag}><Layers size={12} aria-hidden="true" />{status === 'ready' ? '百度底图 · 演示点位' : '街区示意'}</span>
    </div>
    <div className={styles.legend}>
      {geometry.pins.map((marker, index) => <span key={`${marker.label}-${index}`}>
        <span className={marker.kind === 'end' ? styles.endDot : styles.startDot} />
        {marker.kind === 'start' ? '起点 · ' : marker.kind === 'end' ? '终点 · ' : `${index + 1} · `}{marker.label}
      </span>)}
    </div>
    <div className={styles.footer}>
      <p className={styles.caption}>
        {status === 'ready' ? '真实底图 · 点位与路线为 BD-09 固定近似数据，非实时规划' : '路线示意 · 配置百度地图 AK 可启用真实底图'}
      </p>
      {error && <p className={styles.error} role="status">{error}</p>}
      {mode === 'cycling' && isRoute && <p className={styles.caption}>骑行仅为演示；外链降级为公交方案，不是本地真实导航。</p>}
      <div className={styles.actions}>
        {hasKey && status !== 'ready' && <Button variant="secondary" size="sm" disabled={status === 'loading'} onClick={enableMap}>
          {status === 'loading' ? <Spinner size={14} /> : <MapPin size={14} aria-hidden="true" />}
          {status === 'loading' ? '加载中…' : status === 'error' ? '重试百度底图' : '加载百度底图'}
        </Button>}
        <a className={styles.externalLink} href={href} target="_blank" rel="noopener noreferrer">
          打开百度地图<ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
      {hasKey && status !== 'ready' && <p className={styles.privacy}>点击加载后连接百度第三方服务；不自动定位、不发送聊天文本。</p>}
    </div>
  </section>
}
