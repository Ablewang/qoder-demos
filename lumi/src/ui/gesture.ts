export const DRAG_SLOP = 8
export const FLICK_VELOCITY = 0.6

export type Axis = 'x' | 'y'

export function lockAxis(dx: number, dy: number, slop = DRAG_SLOP): Axis | null {
  if (Math.hypot(dx, dy) < slop) return null
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
}

export function sheetOffset(dy: number) {
  return dy >= 0 ? dy : -Math.min(24, Math.sqrt(-dy) * 2)
}

export function sheetDismissDistance(height: number) {
  return Math.min(120, Math.max(48, height * 0.25))
}

export function shouldDismissSheet(offset: number, velocity: number, height: number) {
  return offset >= sheetDismissDistance(height) || (velocity >= FLICK_VELOCITY && offset > 24)
}

export type SwipeDirection = 'start' | 'end'

export function swipeThreshold(width: number, direction: SwipeDirection) {
  return Math.max(64, width * (direction === 'end' ? 0.4 : 0.35))
}

export function swipeOffset(dx: number, width: number) {
  const limit = width * 0.6
  const distance = Math.abs(dx)
  if (distance <= limit) return dx
  return Math.sign(dx) * (limit + Math.sqrt(distance - limit) * 4)
}

export function swipeCommit(dx: number, velocity: number, width: number): SwipeDirection | null {
  if (dx === 0) return null
  const direction: SwipeDirection = dx > 0 ? 'start' : 'end'
  const flickDistance = direction === 'end' ? 72 : 48
  const flick = Math.abs(velocity) >= FLICK_VELOCITY && Math.abs(dx) >= flickDistance && Math.sign(velocity) === Math.sign(dx)
  return Math.abs(dx) >= swipeThreshold(width, direction) || flick ? direction : null
}

export function createVelocityTracker(windowMs = 80) {
  let samples: { value: number; time: number }[] = []
  return {
    reset() { samples = [] },
    add(value: number, time: number) {
      samples.push({ value, time })
      samples = samples.filter(sample => time - sample.time <= windowMs)
    },
    velocity() {
      if (samples.length < 2) return 0
      const first = samples[0]
      const last = samples[samples.length - 1]
      const elapsed = last.time - first.time
      return elapsed > 0 ? (last.value - first.value) / elapsed : 0
    },
  }
}

export function haptic() {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
  try { navigator.vibrate(8) } catch { return }
}

export function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}
