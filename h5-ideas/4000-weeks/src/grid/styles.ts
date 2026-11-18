import { useEffect, useState } from 'preact/hooks'
import { weekIdOf } from '../lib/date'
import { derivedMarks, isEntryEmpty, moodHex, themeHex, type Life, type WeekEntry } from '../lib/model'
import type { CellStyle } from './GridCanvas'
import type { Strip } from './layout'

export type Palette = { past: string; future: string; gold: string; band: string }

export function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement)
  const get = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
  return {
    past: get('--cell-past', '#D3CABC'),
    future: get('--cell-future', '#D5CCBE'),
    gold: get('--gold', '#C9A227'),
    band: get('--band', '#F3E3D6'),
  }
}

export function usePalette(): Palette {
  const [pal, setPal] = useState(readPalette)
  useEffect(() => {
    const q = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setPal(readPalette())
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return pal
}

export function personalStyle(life: Life, all: Life[], entries: Map<number, WeekEntry> | undefined, pal: Palette) {
  const theme = themeHex(life.color)
  const tint = `${theme}59`
  const marks = new Set(derivedMarks(life, all).map((m) => m.weekId))
  const metWeek = life.relation === 'partner' && life.metDate ? weekIdOf(life.metDate) : Infinity
  return (strip: Strip, wk: number): CellStyle => {
    if (wk > strip.livedTo) return { fill: pal.future, hollow: true, future: true }
    const e = entries?.get(wk)
    const ring = e?.milestone || marks.has(wk) ? pal.gold : undefined
    if (e && !isEntryEmpty(e)) return { fill: moodHex(e.color) ?? theme, ring, emoji: e.emoji }
    return { fill: wk >= metWeek ? tint : pal.past, hollow: true, ring }
  }
}

export function compareStyle(lives: Life[], entries: Map<string, Map<number, WeekEntry>>, pal: Palette) {
  const info = new Map(
    lives.map((l) => [
      l.id,
      { theme: themeHex(l.color), marks: new Set(derivedMarks(l, []).map((m) => m.weekId)), entries: entries.get(l.id) },
    ]),
  )
  return (strip: Strip, wk: number): CellStyle => {
    const i = info.get(strip.lifeId)!
    const e = i.entries?.get(wk)
    const ring = e?.milestone || i.marks.has(wk) ? pal.gold : undefined
    if (e && !isEntryEmpty(e)) return { fill: moodHex(e.color) ?? i.theme, ring, emoji: e.emoji }
    return { fill: pal.past, hollow: true, ring }
  }
}
