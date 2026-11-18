import { useEffect, useRef } from 'preact/hooks'
import { HEADER_H, hitTest, type GridLayout, type Hit, type Strip } from './layout'
import { weekKey } from '../lib/date'

export type CellStyle = { fill: string; hollow?: boolean; future?: boolean; ring?: string; emoji?: string }
export type Selection = { lifeId: string; weekId: number } | null
export type Flash = { lifeId: string; weekId: number; at: number } | null

type Props = {
  layout: GridLayout
  gutter: number
  cellStyle: (strip: Strip, weekId: number) => CellStyle
  bandColor?: string
  currentWeek: number
  accent: (lifeId: string) => string
  selected: Selection
  onSelect: (hit: Hit | null) => void
  onActivate?: () => void
  focus?: { weekId: number; lifeId?: string }
  flash?: Flash
  ariaLabel: string
  initialZoom?: number
  compactHeight?: number
  overview?: boolean
  calendarAxis?: boolean
}

const TOP = 6
const BOTTOM = 18
const RIGHT = 8
const CELL = 0.8
const MIN_S = 1
const MAX_S = 10
const TAP_SLOP = 8
/** Screen px a tap may miss a strip by and still select it; rows can be only ~6px tall at 1x. */
const TAP_REACH = 10

const reducedQuery = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null

type View = { w: number; h: number; dpr: number; s: number; tx: number; ty: number; pitch: number; contentH: number }

const labelGaps = new WeakMap<GridLayout, number>()
function labelGap(layout: GridLayout): number {
  let gap = labelGaps.get(layout)
  if (gap === undefined) {
    gap = Infinity
    let prev: number | null = null
    for (const st of layout.strips) {
      if (!st.label) continue
      if (prev !== null) gap = Math.min(gap, st.y - prev)
      prev = st.y
    }
    labelGaps.set(layout, gap)
  }
  return gap
}

function cssVar(el: Element, name: string, fallback: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback
}

export function GridCanvas(props: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLCanvasElement>(null)
  const overRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)
  propsRef.current = props
  const v = useRef<View>({ w: 0, h: 0, dpr: 1, s: props.initialZoom ?? 1, tx: 0, ty: 0, pitch: 6, contentH: 0 })
  const api = useRef<{
    schedule: () => void
    zoomBy: (f: number, cx?: number, cy?: number) => void
    reset: () => void
    ensureVisible: (sel: Selection) => void
    applyFocus: () => void
    calendarHeight: () => number
  } | null>(null)
  const focusedKey = useRef('')

  useEffect(() => {
    const wrap = wrapRef.current!
    const base = baseRef.current!
    const over = overRef.current!
    const bctx = base.getContext('2d')!
    const octx = over.getContext('2d')!
    let colors = readColors()
    let reduced = !!reducedQuery?.matches
    let queued = false
    let animating = 0

    function readColors() {
      return {
        ink: cssVar(wrap, '--ink', '#2B2A28'),
        ink2: cssVar(wrap, '--ink-2', '#8A8378'),
        bg: cssVar(wrap, '--bg', '#F7F3EC'),
        gold: cssVar(wrap, '--gold', '#C9A227'),
      }
    }

    function metrics() {
      const { layout, gutter } = propsRef.current
      const view = v.current
      view.pitch = Math.max(2, (view.w - gutter - RIGHT) / layout.cols)
      view.contentH = TOP + layout.height * view.pitch + (propsRef.current.calendarAxis ? 6 : BOTTOM)
    }

    function calendarHeight() {
      const { layout, initialZoom } = propsRef.current
      const view = v.current
      const scale = Math.max(initialZoom ?? 1, 18 / view.pitch)
      let height = 320
      for (const header of layout.headers.slice(-3).reverse()) {
        const candidate = ((layout.height - header.y) * view.pitch + 6) * scale
        if (candidate > 360) break
        height = candidate
      }
      return height
    }

    function clamp() {
      const view = v.current
      view.s = Math.min(MAX_S, Math.max(MIN_S, view.s))
      const cw = view.w * view.s
      view.tx = Math.min(0, Math.max(view.w - cw, view.tx))
      const ch = view.contentH * view.s
      view.ty = ch <= view.h ? 0 : Math.min(0, Math.max(view.h - ch, view.ty))
    }

    function cellBox(strip: Strip, col: number) {
      const { s, tx, ty, pitch } = v.current
      const { gutter } = propsRef.current
      const size = pitch * s * CELL
      const off = (pitch * s - size) / 2
      return { x: (gutter + col * pitch) * s + tx + off, y: (TOP + strip.y * pitch) * s + ty + off, size }
    }

    function stripsWith(weekId: number, lifeId?: string) {
      return propsRef.current.layout.strips.filter((st) => (!lifeId || st.lifeId === lifeId) && weekId >= st.from && weekId <= st.to)
    }

    function drawBase() {
      const view = v.current
      const { layout, gutter, cellStyle, bandColor } = propsRef.current
      const { s, tx, ty, pitch, w, h, dpr } = view
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bctx.clearRect(0, 0, w, h)

      if (bandColor) {
        bctx.fillStyle = bandColor
        for (const b of layout.bands) {
          const x0 = (gutter + b.col0 * pitch) * s + tx
          const x1 = (gutter + (b.col1 + 1) * pitch) * s + tx
          const y0 = (TOP + b.y0 * pitch) * s + ty - pitch * s * 0.2
          const y1 = (TOP + b.y1 * pitch) * s + ty + pitch * s * 0.2
          if (y1 < 0 || y0 > h) continue
          bctx.fillRect(x0, y0, x1 - x0, y1 - y0)
        }
      }

      if (propsRef.current.calendarAxis && propsRef.current.selected) {
        const selected = propsRef.current.selected
        const rows = layout.strips.filter(st => selected.weekId >= st.startWeek && selected.weekId < st.startWeek + st.length)
        for (const row of rows) {
          const box = cellBox(row, selected.weekId - row.startWeek)
          bctx.fillStyle = colors.gold
          bctx.globalAlpha = 0.12
          bctx.fillRect(box.x - pitch * s * 0.1, box.y - pitch * s * 0.1, pitch * s, pitch * s)
          bctx.globalAlpha = 1
        }
      }
      const fills = new Map<string, number[]>()
      const hollows = new Map<string, number[]>()
      const futures = new Map<string, number[]>()
      const rings: Array<[string, number, number, number]> = []
      const emojis: Array<[string, number, number, number]> = []
      const markedRows: number[] = []
      const size = pitch * s * CELL
      const colFrom = Math.max(0, Math.floor((-tx / s - gutter) / pitch) - 1)
      const colTo = Math.ceil(((w - tx) / s - gutter) / pitch) + 1

      for (const strip of layout.strips) {
        const sy = (TOP + strip.y * pitch) * s + ty
        if (sy > h || sy + pitch * s < 0) continue
        let rowMarked = false
        const end = Math.min(strip.length - 1, colTo)
        for (let col = colFrom; col <= end; col++) {
          const wk = strip.startWeek + col
          if (wk < strip.from || wk > strip.to) continue
          const st = cellStyle(strip, wk)
          const box = cellBox(strip, col)
          const target = st.future ? futures : st.hollow ? hollows : fills
          let arr = target.get(st.fill)
          if (!arr) target.set(st.fill, (arr = []))
          arr.push(box.x, box.y)
          if (st.ring) {
            rings.push([st.ring, box.x, box.y, box.size])
            rowMarked = true
          }
          if (st.emoji && size >= 16) emojis.push([st.emoji, box.x, box.y, box.size])
        }
        if (rowMarked) markedRows.push(sy + (pitch * s) / 2)
      }

      const round = false
      const r = 0
      for (const [color, arr] of fills) {
        bctx.fillStyle = color
        bctx.beginPath()
        for (let i = 0; i < arr.length; i += 2) {
          if (round) bctx.roundRect(arr[i], arr[i + 1], size, size, r)
          else bctx.rect(arr[i], arr[i + 1], size, size)
        }
        bctx.fill()
      }
      const lw = Math.max(0.6, Math.min(1.2, size * 0.14))
      bctx.lineWidth = lw
      for (const [color, arr] of hollows) {
        bctx.strokeStyle = color
        bctx.beginPath()
        for (let i = 0; i < arr.length; i += 2) {
          if (round) bctx.roundRect(arr[i] + lw / 2, arr[i + 1] + lw / 2, size - lw, size - lw, r)
          else bctx.rect(arr[i] + lw / 2, arr[i + 1] + lw / 2, size - lw, size - lw)
        }
        bctx.stroke()
      }
      bctx.setLineDash([Math.max(0.7, size / 4), Math.max(0.7, size / 4)])
      bctx.lineWidth = lw
      for (const [color, arr] of futures) {
        bctx.strokeStyle = color
        bctx.beginPath()
        for (let i = 0; i < arr.length; i += 2) bctx.rect(arr[i] + lw / 2, arr[i + 1] + lw / 2, size - lw, size - lw)
        bctx.stroke()
      }
      bctx.setLineDash([])
      for (const [color, x, y, sz] of rings) {
        const rw = Math.max(1, sz * 0.12)
        bctx.strokeStyle = color
        bctx.lineWidth = rw
        bctx.strokeRect(x - rw / 2 - 0.5, y - rw / 2 - 0.5, sz + rw + 1, sz + rw + 1)
      }
      if (emojis.length) {
        bctx.textAlign = 'center'
        bctx.textBaseline = 'middle'
        for (const [e, x, y, sz] of emojis) {
          bctx.font = `${Math.round(sz * 0.62)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
          bctx.fillText(e, x + sz / 2, y + sz / 2 + sz * 0.04)
        }
      }

      // Labels stay in screen space so they keep a readable size at any zoom.
      bctx.textAlign = 'left'
      bctx.textBaseline = 'middle'
      bctx.font = '12px -apple-system, "PingFang SC", system-ui, sans-serif'
      const gutterScreen = gutter * s + tx
      const showLabels = labelGap(layout) * pitch * s >= 15
      for (const strip of layout.strips) {
        if (!strip.label || !showLabels) continue
        const cy = (TOP + strip.y * pitch) * s + ty + (pitch * s) / 2
        if (cy < -10 || cy > h + 10) continue
        const tw = bctx.measureText(strip.label).width
        if (gutterScreen < tw + 8) {
          bctx.fillStyle = colors.bg
          bctx.globalAlpha = 0.86
          bctx.fillRect(1, cy - 7, tw + 6, 14)
          bctx.globalAlpha = 1
        }
        bctx.fillStyle = colors.ink2
        bctx.fillText(strip.label, 4, cy)
      }
      bctx.fillStyle = colors.gold
      for (const cy of markedRows) {
        if (gutterScreen >= 6) {
          bctx.beginPath()
          bctx.arc(gutterScreen - 3, cy, 1.5, 0, Math.PI * 2)
          bctx.fill()
        }
      }
      bctx.font = '12px -apple-system, "PingFang SC", system-ui, sans-serif'
      bctx.textBaseline = 'alphabetic'
      bctx.fillStyle = colors.ink
      for (const hd of layout.headers) {
        const y = (TOP + (hd.y + HEADER_H) * pitch) * s + ty - 6
        if (y < -4 || y > h + 14) continue
        bctx.fillText(hd.text, 4, y)
        if (propsRef.current.calendarAxis) {
          const strip = layout.strips.find(st => st.y >= hd.y && st.y < hd.y + HEADER_H + 1)
          if (!strip) continue
          const first = Math.max(0, Math.ceil((-tx / s - gutter) / pitch))
          const last = Math.min(strip.length - 1, Math.floor(((w - 16 - tx) / s - gutter) / pitch))
          const gap = Math.max(1, Math.ceil(72 / (pitch * s)))
          let previousRight = -Infinity
          const selectedColumn = propsRef.current.selected ? propsRef.current.selected.weekId - strip.startWeek : -1
          const middle = selectedColumn >= first && selectedColumn <= last ? selectedColumn : Math.floor((first + last) / 2)
          for (const col of [...new Set([first, middle, last])]) {
            if (col < first || col > last || (col !== first && col - first < gap)) continue
            const label = weekKey(strip.startWeek + col).slice(5).replace('-', '.')
            const tw = bctx.measureText(label).width
            const center = (gutter + (col + 0.5) * pitch) * s + tx
            const x = Math.max(46, Math.min(w - tw - 4, center - tw / 2))
            if (x < previousRight + 10) continue
            bctx.fillStyle = colors.ink2
            bctx.fillText(label, x, y)
            bctx.strokeStyle = col === selectedColumn ? colors.ink : colors.ink2
            bctx.lineWidth = 1
            bctx.beginPath()
            bctx.moveTo(center, y + 2)
            bctx.lineTo(center, y + 6)
            bctx.stroke()
            previousRight = x + tw
          }
        }
      }
    }

    function ringAround(x: number, y: number, sz: number, color: string, width: number, alpha = 1, grow = 0) {
      octx.globalAlpha = alpha
      octx.strokeStyle = color
      octx.lineWidth = width
      const o = width / 2 + 0.5 + grow
      if (sz >= 8) {
        octx.beginPath()
        octx.roundRect(x - o, y - o, sz + o * 2, sz + o * 2, sz * 0.25 + o)
        octx.stroke()
      } else {
        octx.strokeRect(x - o, y - o, sz + o * 2, sz + o * 2)
      }
      octx.globalAlpha = 1
    }

    function drawOverlay(now: number): boolean {
      const view = v.current
      const { currentWeek, accent, selected, flash } = propsRef.current
      octx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0)
      octx.clearRect(0, 0, view.w, view.h)
      let needsFrame = false
      for (const strip of stripsWith(currentWeek)) {
        const box = cellBox(strip, currentWeek - strip.startWeek)
        if (box.y > view.h || box.y + box.size < 0) continue
        const color = accent(strip.lifeId)
        if (reduced) {
          ringAround(box.x, box.y, box.size, color, 1.2)
          ringAround(box.x, box.y, box.size, color, 1, 0.5, 2.2)
        } else {
          const phase = (now % 2400) / 2400
          const k = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2)
          ringAround(box.x, box.y, box.size, color, 1.2)
          ringAround(box.x, box.y, box.size, color, 2.5, 0.12 + 0.45 * k, 0.5 + 2 * k)
          needsFrame = !document.hidden
        }
      }
      if (flash && !reduced) {
        const age = now - flash.at
        if (age < 700) {
          for (const strip of stripsWith(flash.weekId, flash.lifeId)) {
            const box = cellBox(strip, flash.weekId - strip.startWeek)
            const k = age / 700
            ringAround(box.x, box.y, box.size, accent(flash.lifeId), 2, 1 - k, 1 + 8 * k)
          }
          needsFrame = true
        }
      }
      if (selected) {
        for (const strip of stripsWith(selected.weekId, selected.lifeId)) {
          const box = cellBox(strip, selected.weekId - strip.startWeek)
          ringAround(box.x, box.y, box.size, colors.ink, 2, 1, 0.5)
        }
      }
      return needsFrame
    }

    function loop(now: number) {
      animating = 0
      if (drawOverlay(now)) animating = requestAnimationFrame(loop)
    }

    function schedule() {
      if (queued) return
      queued = true
      requestAnimationFrame((now) => {
        queued = false
        drawBase()
        if (!animating) loop(now)
        else drawOverlay(now)
      })
    }

    function resize() {
      const rect = wrap.getBoundingClientRect()
      const view = v.current
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      view.w = rect.width
      view.dpr = dpr
      metrics()
      if (propsRef.current.overview) wrap.style.height = `${view.contentH}px`
      else if (propsRef.current.calendarAxis) {
        if (!focusedKey.current) view.s = Math.max(propsRef.current.initialZoom ?? 1, 18 / view.pitch)
        wrap.style.height = `${calendarHeight()}px`
      }
      view.h = wrap.getBoundingClientRect().height
      for (const c of [base, over]) {
        c.width = Math.round(view.w * dpr)
        c.height = Math.round(view.h * dpr)
      }
      clamp()
      applyFocus()
      ensureVisible(propsRef.current.selected)
      schedule()
    }

    function zoomBy(f: number, cx = v.current.w / 2, cy = v.current.h / 2) {
      const view = v.current
      const ns = Math.min(MAX_S, Math.max(MIN_S, view.s * f))
      const wx = (cx - view.tx) / view.s
      const wy = (cy - view.ty) / view.s
      view.s = ns
      view.tx = cx - wx * ns
      view.ty = cy - wy * ns
      clamp()
      schedule()
    }

    function centerOn(strip: Strip, weekId: number, yFrac = 0.4) {
      const view = v.current
      const box = cellBox(strip, weekId - strip.startWeek)
      view.tx += view.w / 2 - (box.x + box.size / 2)
      view.ty += view.h * yFrac - (box.y + box.size / 2)
      clamp()
    }

    function ensureVisible(sel: Selection) {
      if (!sel) return
      const strip = stripsWith(sel.weekId, sel.lifeId)[0]
      if (!strip) return
      const view = v.current
      const box = cellBox(strip, sel.weekId - strip.startWeek)
      const m = 12
      if (box.x < m || box.y < m || box.x + box.size > view.w - m || box.y + box.size > view.h - m) {
        centerOn(strip, sel.weekId)
        schedule()
      }
    }

    function applyFocus() {
      const { focus, layout } = propsRef.current
      if (!focus || v.current.w === 0) return
      const key = `${focus.weekId}|${focus.lifeId ?? ''}|${layout.strips.length}`
      if (focusedKey.current === key) return
      focusedKey.current = key
      const strip = stripsWith(focus.weekId, focus.lifeId)[0]
      if (strip) centerOn(strip, focus.weekId, 0.3)
    }

    function reset() {
      v.current.s = propsRef.current.calendarAxis ? Math.max(propsRef.current.initialZoom ?? 1, 18 / v.current.pitch) : propsRef.current.initialZoom ?? 1
      v.current.tx = 0
      focusedKey.current = ''
      applyFocus()
      clamp()
      schedule()
    }

    api.current = { schedule, zoomBy, reset, ensureVisible, applyFocus, calendarHeight }

    // Gestures: a tap only selects (never writes); any movement beyond TAP_SLOP or a second finger cancels the tap.
    const pts = new Map<number, { x: number; y: number }>()
    let g = { mode: 'none' as 'none' | 'pan' | 'pinch', x0: 0, y0: 0, tx0: 0, ty0: 0, t0: 0, moved: false, multi: false, d0: 1, s0: 1, wx: 0, wy: 0 }
    const pos = (e: PointerEvent) => {
      const r = over.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    function startPan(p: { x: number; y: number }, multi: boolean) {
      g = { ...g, mode: 'pan', x0: p.x, y0: p.y, tx0: v.current.tx, ty0: v.current.ty, t0: performance.now(), moved: multi, multi }
    }
    function startPinch() {
      const [a, b] = [...pts.values()]
      const view = v.current
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      g = { ...g, mode: 'pinch', multi: true, moved: true, d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), s0: view.s, wx: (mx - view.tx) / view.s, wy: (my - view.ty) / view.s }
    }
    function onDown(e: PointerEvent) {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      over.setPointerCapture(e.pointerId)
      pts.set(e.pointerId, pos(e))
      if (pts.size === 1) startPan(pos(e), false)
      else if (pts.size === 2) startPinch()
    }
    function onMove(e: PointerEvent) {
      if (!pts.has(e.pointerId)) return
      const p = pos(e)
      pts.set(e.pointerId, p)
      const view = v.current
      if (g.mode === 'pan') {
        const dx = p.x - g.x0
        const dy = p.y - g.y0
        if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP) g.moved = true
        if (g.moved) {
          view.tx = g.tx0 + dx
          view.ty = g.ty0 + dy
          clamp()
          schedule()
        }
      } else if (g.mode === 'pinch' && pts.size >= 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        const ns = Math.min(MAX_S, Math.max(MIN_S, (g.s0 * d) / g.d0))
        view.s = ns
        view.tx = (a.x + b.x) / 2 - g.wx * ns
        view.ty = (a.y + b.y) / 2 - g.wy * ns
        clamp()
        schedule()
      }
    }
    function onUp(e: PointerEvent) {
      if (!pts.has(e.pointerId)) return
      const p = pos(e)
      pts.delete(e.pointerId)
      const wasTap = e.type === 'pointerup' && g.mode === 'pan' && !g.moved && !g.multi && performance.now() - g.t0 < 700
      if (pts.size === 1) startPan([...pts.values()][0], true)
      else if (pts.size === 0) g.mode = 'none'
      if (wasTap) tap(p.x, p.y)
    }
    function tap(x: number, y: number) {
      const view = v.current
      const { layout, gutter, onSelect } = propsRef.current
      const gx = ((x - view.tx) / view.s - gutter) / view.pitch
      const gy = ((y - view.ty) / view.s - TOP) / view.pitch
      onSelect(hitTest(layout, gx, gy, TAP_REACH / (view.pitch * view.s)))
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const r = over.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top)
      } else {
        v.current.tx -= e.deltaX
        v.current.ty -= e.deltaY
        clamp()
        schedule()
      }
    }
    function onKey(e: KeyboardEvent) {
      if (document.querySelector('[role=dialog]')) return
      const { selected, layout, currentWeek, onSelect, onActivate } = propsRef.current
      const strips = layout.strips
      const pick = (strip: Strip | undefined, weekId: number) => {
        if (strip && weekId >= strip.from && weekId <= strip.to) onSelect({ strip, weekId })
      }
      const curStrip = selected ? strips.find((st) => st.lifeId === selected.lifeId && selected.weekId >= st.from && selected.weekId <= st.to) : undefined
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault()
          if (!selected || !curStrip) {
            const st = stripsWith(currentWeek)[0] ?? strips[strips.length - 1]
            if (st) pick(st, Math.min(currentWeek, st.to))
            return
          }
          const wk = selected.weekId + (e.key === 'ArrowLeft' ? -1 : 1)
          pick(stripsWith(wk, selected.lifeId)[0], wk)
          return
        }
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault()
          if (!selected || !curStrip) return
          const idx = strips.indexOf(curStrip)
          const step = e.key === 'ArrowUp' ? -1 : 1
          for (let i = idx + step; i >= 0 && i < strips.length; i += step) {
            const st = strips[i]
            const col = Math.min(selected.weekId - curStrip.startWeek, st.length - 1)
            const wk = Math.min(st.to, Math.max(st.from, st.startWeek + col))
            if (wk >= st.from && wk <= st.to) {
              pick(st, wk)
              return
            }
          }
          return
        }
        case 'Enter':
        case ' ':
          if (selected) {
            e.preventDefault()
            onActivate?.()
          }
          return
        case 'Escape':
          onSelect(null)
          return
        case '+':
        case '=':
          e.preventDefault()
          zoomBy(1.5)
          return
        case '-':
          e.preventDefault()
          zoomBy(1 / 1.5)
          return
        case '0':
          reset()
          return
      }
    }

    over.addEventListener('pointerdown', onDown)
    over.addEventListener('pointermove', onMove)
    over.addEventListener('pointerup', onUp)
    over.addEventListener('pointercancel', onUp)
    over.addEventListener('wheel', onWheel, { passive: false })
    over.addEventListener('keydown', onKey)
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    const onMotion = () => {
      reduced = !!reducedQuery?.matches
      schedule()
    }
    reducedQuery?.addEventListener('change', onMotion)
    const scheme = matchMedia('(prefers-color-scheme: dark)')
    const onScheme = () => {
      colors = readColors()
      schedule()
    }
    scheme.addEventListener('change', onScheme)
    const onVis = () => {
      if (!document.hidden) schedule()
    }
    document.addEventListener('visibilitychange', onVis)
    resize()

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animating)
      reducedQuery?.removeEventListener('change', onMotion)
      scheme.removeEventListener('change', onScheme)
      document.removeEventListener('visibilitychange', onVis)
      over.removeEventListener('pointerdown', onDown)
      over.removeEventListener('pointermove', onMove)
      over.removeEventListener('pointerup', onUp)
      over.removeEventListener('pointercancel', onUp)
      over.removeEventListener('wheel', onWheel)
      over.removeEventListener('keydown', onKey)
      api.current = null
    }
  }, [])

  useEffect(() => {
    const a = api.current
    if (!a) return
    const view = v.current
    const { layout, gutter } = props
    view.pitch = Math.max(2, (view.w - gutter - RIGHT) / layout.cols)
    view.contentH = TOP + layout.height * view.pitch + (props.calendarAxis ? 6 : BOTTOM)
    if (props.overview && wrapRef.current) wrapRef.current.style.height = `${view.contentH}px`
    else if (props.calendarAxis && wrapRef.current) wrapRef.current.style.height = `${a.calendarHeight()}px`
    a.applyFocus()
    a.schedule()
  })

  useEffect(() => {
    api.current?.ensureVisible(props.selected)
  }, [props.selected?.lifeId, props.selected?.weekId])

  return (
    <div class="grid-box">
      <div class={`grid-wrap${props.overview ? ' overview-wrap' : ''}`} ref={wrapRef} style={props.compactHeight ? { height: `${props.compactHeight}px`, minHeight: 0 } : props.overview ? { aspectRatio: `${props.layout.cols} / ${props.layout.height + 5}` } : undefined}>
        <canvas ref={baseRef} class="grid-canvas" aria-hidden="true" />
        <canvas
          ref={overRef}
          class="grid-canvas grid-over"
          tabIndex={0}
          role="img"
          aria-label={`${props.ariaLabel}。方向键选择周，回车打开，加号减号缩放。`}
        />
      </div>
      <div class="zoom-btns">
        <span class="zoom-hint">拖动 / 双指缩放<br />点格查看 · 键盘可用</span>
        <button type="button" aria-label="缩小" onClick={() => api.current?.zoomBy(1 / 1.6)}>－</button>
        <button type="button" aria-label="放大" onClick={() => api.current?.zoomBy(1.6)}>＋</button>
        <button type="button" aria-label="复位" onClick={() => api.current?.reset()}>复位</button>
      </div>
    </div>
  )
}
