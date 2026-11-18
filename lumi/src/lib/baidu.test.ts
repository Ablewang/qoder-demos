import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BaiduMap } from '../features/map/BaiduMap'
import * as baidu from './baidu'
import {
  createBaiduDirectionUrl, createBaiduMarkerUrl, isValidBaiduPoint,
  type BaiduMapSDK,
} from './baidu'

const origin = { lat: 30.2575, lng: 120.1618 }
const destination = { lat: 30.2497, lng: 120.1742 }

describe('百度地图 BD-09 网页 URI', () => {
  it.each(['walking', 'transit', 'driving'] as const)('编码 %s 导航的坐标与区域', mode => {
    const url = new URL(createBaiduDirectionUrl({ origin, destination, mode }))
    expect(url.origin + url.pathname).toBe('https://api.map.baidu.com/direction')
    expect(url.searchParams.get('origin')).toBe('30.2575,120.1618')
    expect(url.searchParams.get('destination')).toBe('30.2497,120.1742')
    expect(url.searchParams.get('mode')).toBe(mode)
    expect(url.searchParams.get('region')).toBe('杭州')
    expect(url.searchParams.get('coord_type')).toBe('bd09ll')
    expect(url.searchParams.get('output')).toBe('html')
    expect(url.searchParams.get('src')).toBe('lumi')
    expect(url.href).not.toContain('杭州')
  })

  it('骑行降级为百度网页公交方案', () => {
    const url = new URL(createBaiduDirectionUrl({ origin, destination, mode: 'cycling' }))
    expect(url.searchParams.get('mode')).toBe('transit')
  })

  it('地点标题与地址中的中文、& 和 # 不注入额外参数', () => {
    const title = '茶 & 饭 #1'
    const address = '杭州市·河坊街 18 号 & src=evil'
    const url = new URL(createBaiduMarkerUrl({ point: origin, title, address }))
    expect(url.origin + url.pathname).toBe('https://api.map.baidu.com/marker')
    expect(url.searchParams.get('location')).toBe('30.2575,120.1618')
    expect(url.searchParams.get('title')).toBe(title)
    expect(url.searchParams.get('content')).toBe(address)
    expect(url.searchParams.getAll('src')).toEqual(['lumi'])
    expect(url.hash).toBe('')
    expect(url.searchParams.get('coord_type')).toBe('bd09ll')
  })

  it('拒绝非有限或越界坐标，不生成无效跳转', () => {
    expect(isValidBaiduPoint(origin)).toBe(true)
    expect(isValidBaiduPoint({ lat: 91, lng: 120 })).toBe(false)
    expect(isValidBaiduPoint({ lat: 30, lng: Infinity })).toBe(false)
    expect(() => createBaiduMarkerUrl({ point: { lat: NaN, lng: 120 }, title: '无效地点' })).toThrow('无效的 BD-09 坐标')
    expect(() => createBaiduDirectionUrl({ origin, destination: { lat: 30, lng: 181 }, mode: 'walking' })).toThrow()
  })
})

// A tiny browser boundary instead of adding a DOM dependency to the project.
function browserHarness() {
  const scripts: { src: string; async: boolean; onerror: (() => void) | null; remove: ReturnType<typeof vi.fn> }[] = []
  const globals: Record<string, unknown> = {
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
  }
  vi.stubGlobal('window', globals)
  vi.stubGlobal('document', {
    createElement: () => ({ src: '', async: false, onerror: null, remove: vi.fn() }),
    head: { appendChild: (script: (typeof scripts)[number]) => { scripts.push(script); return script } },
  })
  return { scripts, globals }
}

function fakeSDK(): BaiduMapSDK {
  return {
    Map: class {
      centerAndZoom() {}
      enableScrollWheelZoom() {}
      addOverlay() {}
      clearOverlays() {}
      setViewport() {}
      destroy() {}
    },
    Point: class { constructor(public lng: number, public lat: number) {} },
    Marker: class {},
    Polyline: class {},
  }
}

function callCallback(globals: Record<string, unknown>, src: string) {
  const name = new URL(src).searchParams.get('callback')
  expect(name).toBeTruthy()
  const callback: unknown = name ? globals[name] : undefined
  if (typeof callback !== 'function') throw new Error('Missing map callback')
  callback()
  return name
}

describe('百度地图组件的无 AK 示意与外链', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

  it('提供街块、河流、真实坐标投影折线与起终点，而不是空灰框', () => {
    vi.stubEnv('VITE_BAIDU_MAP_AK', '')
    const load = vi.spyOn(baidu, 'loadBaiduMap')
    const html = renderToStaticMarkup(createElement(BaiduMap, {
      origin, destination, points: [origin, { lng: 120.17, lat: 30.255 }, destination], title: '路线预览',
    }))
    expect(html).toContain('<svg')
    expect(html).toContain('<rect')
    expect(html).toContain('C 345 50')
    expect(html).toContain('M 70.0 65.0')
    expect(html).toContain('起点')
    expect(html).toContain('终点')
    expect(html).toContain('路线示意 · 配置百度地图 AK 可启用真实底图')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
    expect(html).not.toContain('加载百度底图')
    expect(load).not.toHaveBeenCalled()
  })

  it('有 AK 的初始渲染仍不自动加载脚本，显示明确集成入口', () => {
    vi.stubEnv('VITE_BAIDU_MAP_AK', 'test-ak')
    const load = vi.spyOn(baidu, 'loadBaiduMap')
    const html = renderToStaticMarkup(createElement(BaiduMap, { origin, destination }))
    expect(html).toContain('加载百度底图')
    expect(html).toContain('不自动定位、不发送聊天文本')
    expect(load).not.toHaveBeenCalled()
    expect(html).not.toContain('<script')
  })

  it('地点与骑行场景的链接及降级提示保持一致', () => {
    vi.stubEnv('VITE_BAIDU_MAP_AK', '')
    const location = renderToStaticMarkup(createElement(BaiduMap, {
      markers: [{ point: origin, label: '河边茶馆 & 小店' }],
    }))
    const href = /href="([^"]+)"/.exec(location)?.[1].replaceAll('&amp;', '&')
    expect(href).toBeTruthy()
    const marker = new URL(href ?? '')
    expect(marker.searchParams.get('location')).toBe('30.2575,120.1618')
    expect(marker.searchParams.get('title')).toBe('河边茶馆 & 小店')
    const cycling = renderToStaticMarkup(createElement(BaiduMap, { origin, destination, mode: 'cycling' }))
    expect(cycling).toContain('外链降级为公交方案，不是本地真实导航')
    expect(cycling).toContain('mode=transit')
  })

  it('空数据与无效点位仍绘制安全的杭州示意位置', () => {
    const html = renderToStaticMarkup(createElement(BaiduMap, {
      markers: [{ point: { lat: NaN, lng: Infinity }, label: '无效点' }], points: [],
    }))
    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
    expect(html).not.toContain('Infinity')
    expect(html).toContain('location=30.2575%2C120.1618')
  })
})

describe('百度 GL 按需单例加载器', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.stubEnv('VITE_BAIDU_MAP_AK', 'test key & special')
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('无 AK 时拒绝且不添加任何第三方脚本', async () => {
    vi.stubEnv('VITE_BAIDU_MAP_AK', '')
    const { scripts } = browserHarness()
    const { loadBaiduMap } = await import('./baidu')
    await expect(loadBaiduMap()).rejects.toThrow('尚未配置')
    expect(scripts).toHaveLength(0)
  })

  it('并发调用复用同一 Promise，回调成功后缓存 SDK 并清理定时器', async () => {
    const { scripts, globals } = browserHarness()
    const { loadBaiduMap } = await import('./baidu')
    const first = loadBaiduMap()
    expect(loadBaiduMap()).toBe(first)
    expect(scripts).toHaveLength(1)
    const url = new URL(scripts[0].src)
    expect(url.searchParams.get('ak')).toBe('test key & special')
    expect(url.searchParams.get('type')).toBe('webgl')
    expect(scripts[0].async).toBe(true)
    const sdk = fakeSDK()
    globals.BMapGL = sdk
    const callbackName = callCallback(globals, scripts[0].src)
    await expect(first).resolves.toBe(sdk)
    expect(loadBaiduMap()).toBe(first)
    expect(callbackName && globals[callbackName]).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
    expect(scripts[0].remove).not.toHaveBeenCalled()
  })

  it('已有 SDK 不重复注入脚本', async () => {
    const { scripts, globals } = browserHarness()
    const sdk = fakeSDK()
    globals.BMapGL = sdk
    const { loadBaiduMap } = await import('./baidu')
    await expect(loadBaiduMap()).resolves.toBe(sdk)
    expect(scripts).toHaveLength(0)
  })

  it('网络错误移除脚本与回调，下一次显式请求可以重试', async () => {
    const { scripts, globals } = browserHarness()
    const { loadBaiduMap } = await import('./baidu')
    const pending = loadBaiduMap()
    const result = expect(pending).rejects.toThrow('加载失败')
    const oldCallback = new URL(scripts[0].src).searchParams.get('callback')
    scripts[0].onerror?.()
    await result
    expect(scripts[0].remove).toHaveBeenCalledOnce()
    expect(oldCallback && globals[oldCallback]).toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
    const retry = loadBaiduMap()
    expect(retry).not.toBe(pending)
    expect(scripts).toHaveLength(2)
    expect(new URL(scripts[1].src).searchParams.get('callback')).not.toBe(oldCallback)
    globals.BMapGL = fakeSDK()
    callCallback(globals, scripts[1].src)
    await expect(retry).resolves.toBe(globals.BMapGL)
  })

  it('超时保留可重试状态并清理残留脚本', async () => {
    const { scripts, globals } = browserHarness()
    const { loadBaiduMap, BAIDU_MAP_TIMEOUT_MS } = await import('./baidu')
    const result = expect(loadBaiduMap()).rejects.toThrow('加载超时')
    await vi.advanceTimersByTimeAsync(BAIDU_MAP_TIMEOUT_MS)
    await result
    expect(scripts[0].remove).toHaveBeenCalledOnce()
    expect(Object.keys(globals).some(key => key.startsWith('__lumiBaiduMapReady'))).toBe(false)
  })

  it('无有效 GL SDK 的回调失败，而非误报成功', async () => {
    const { scripts, globals } = browserHarness()
    const { loadBaiduMap } = await import('./baidu')
    const result = expect(loadBaiduMap()).rejects.toThrow('初始化失败')
    callCallback(globals, scripts[0].src)
    await result
    expect(scripts[0].remove).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('服务端环境不会尝试创建脚本', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const { loadBaiduMap } = await import('./baidu')
    await expect(loadBaiduMap()).rejects.toThrow('浏览器环境')
  })
})
