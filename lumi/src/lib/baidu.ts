import type { Point, RouteMode } from '../api/types'

// Only the small BMapGL surface used by our integration is described here.
export interface BaiduPoint { lng: number; lat: number }
export type BaiduOverlay = object
export interface BaiduMapInstance {
  centerAndZoom(point: BaiduPoint, zoom: number): void
  enableScrollWheelZoom(enabled: boolean): void
  addOverlay(overlay: BaiduOverlay): void
  clearOverlays(): void
  setViewport(points: BaiduPoint[], options?: { margins: number[] }): void
  checkResize?: () => void
  resize?: () => void
  destroy(): void
}
export interface BaiduMapSDK {
  Map: new (container: HTMLElement, options?: { enableAutoResize: boolean }) => BaiduMapInstance
  Point: new (lng: number, lat: number) => BaiduPoint
  Marker: new (point: BaiduPoint) => BaiduOverlay
  Polyline: new (points: BaiduPoint[], options: {
    strokeColor: string; strokeWeight: number; strokeOpacity: number
  }) => BaiduOverlay
}

type BaiduWindow = Window & { BMapGL?: BaiduMapSDK } & Record<string, unknown>
export const BAIDU_MAP_TIMEOUT_MS = 12_000
let sdkPromise: Promise<BaiduMapSDK> | undefined
let callbackSequence = 0

export function getBaiduMapKey(): string {
  const key: unknown = import.meta.env.VITE_BAIDU_MAP_AK
  return typeof key === 'string' ? key.trim() : ''
}

/** Called only after the user explicitly opts into the third-party basemap. */
export function loadBaiduMap(): Promise<BaiduMapSDK> {
  if (sdkPromise) return sdkPromise
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('百度地图仅支持浏览器环境'))
  }
  const globals = window as unknown as BaiduWindow
  if (globals.BMapGL) {
    sdkPromise = Promise.resolve(globals.BMapGL)
    return sdkPromise
  }
  const key = getBaiduMapKey()
  if (!key) return Promise.reject(new Error('尚未配置百度地图 AK'))

  const pending = new Promise<BaiduMapSDK>((resolve, reject) => {
    const callback = `__lumiBaiduMapReady_${++callbackSequence}`
    const script = document.createElement('script')
    let settled = false
    const cleanup = () => {
      window.clearTimeout(timer)
      script.onerror = null
      delete globals[callback]
    }
    const fail = (message: string) => {
      if (settled) return
      settled = true
      cleanup()
      script.remove()
      reject(new Error(message))
    }
    const timer = window.setTimeout(() => fail('百度地图加载超时，请稍后重试'), BAIDU_MAP_TIMEOUT_MS)
    globals[callback] = () => {
      if (settled) return
      const sdk = globals.BMapGL
      if (!sdk || typeof sdk.Map !== 'function' || typeof sdk.Point !== 'function'
        || typeof sdk.Marker !== 'function' || typeof sdk.Polyline !== 'function') {
        fail('百度地图初始化失败，请检查 AK 配置')
        return
      }
      settled = true
      cleanup()
      resolve(sdk)
    }
    script.async = true
    const url = new URL('https://api.map.baidu.com/api')
    url.search = new URLSearchParams({ v: '1.0', type: 'webgl', ak: key, callback }).toString()
    script.src = url.toString()
    script.onerror = () => fail('百度地图加载失败，请检查网络或 AK 配置')
    try {
      document.head.appendChild(script)
    } catch {
      fail('无法加载百度地图脚本')
    }
  })
  sdkPromise = pending
  // Keep concurrent consumers on one promise; allow an explicit retry after failure.
  void pending.catch(() => { if (sdkPromise === pending) sdkPromise = undefined })
  return pending
}

export function isValidBaiduPoint(point: Point): boolean {
  return Number.isFinite(point.lng) && Number.isFinite(point.lat)
    && Math.abs(point.lng) <= 180 && Math.abs(point.lat) <= 90
}

function coordinates(point: Point): string {
  if (!isValidBaiduPoint(point)) throw new Error('无效的 BD-09 坐标')
  return `${point.lat},${point.lng}`
}

export function createBaiduDirectionUrl({ origin, destination, mode, region = '杭州' }: {
  origin: Point; destination: Point; mode: RouteMode; region?: string
}): string {
  const url = new URL('https://api.map.baidu.com/direction')
  url.search = new URLSearchParams({
    origin: coordinates(origin), destination: coordinates(destination),
    // Baidu's documented web direction URI does not support a cycling mode.
    mode: mode === 'cycling' ? 'transit' : mode,
    region, output: 'html', src: 'lumi', coord_type: 'bd09ll',
  }).toString()
  return url.toString()
}

export function createBaiduMarkerUrl({ point, title, address = '' }: {
  point: Point; title: string; address?: string
}): string {
  const url = new URL('https://api.map.baidu.com/marker')
  url.search = new URLSearchParams({
    location: coordinates(point), title, content: address,
    output: 'html', src: 'lumi', coord_type: 'bd09ll',
  }).toString()
  return url.toString()
}
