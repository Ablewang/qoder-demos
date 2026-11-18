import { describe, expect, it } from 'vitest'
import { createVelocityTracker, lockAxis, sheetDismissDistance, sheetOffset, shouldDismissSheet, swipeCommit, swipeOffset, swipeThreshold } from './gesture'

describe('gesture decisions', () => {
  it('locks an axis only after the slop distance', () => {
    expect(lockAxis(3, 4)).toBeNull()
    expect(lockAxis(2, 9)).toBe('y')
    expect(lockAxis(-12, 5)).toBe('x')
    expect(lockAxis(6, 6, 8)).toBe('y')
  })

  it('follows downward drags and resists upward drags', () => {
    expect(sheetOffset(80)).toBe(80)
    expect(sheetOffset(-4)).toBe(-4)
    expect(sheetOffset(-400)).toBe(-24)
  })

  it('dismisses a sheet by distance or by a fast downward flick', () => {
    expect(sheetDismissDistance(300)).toBe(75)
    expect(sheetDismissDistance(800)).toBe(120)
    expect(sheetDismissDistance(100)).toBe(48)
    expect(shouldDismissSheet(119, 0, 800)).toBe(false)
    expect(shouldDismissSheet(120, 0, 800)).toBe(true)
    expect(shouldDismissSheet(30, 0.8, 800)).toBe(true)
    expect(shouldDismissSheet(20, 2, 800)).toBe(false)
    expect(shouldDismissSheet(60, -1, 800)).toBe(false)
  })

  it('commits a row swipe past its threshold or on a matching flick', () => {
    expect(swipeThreshold(350, 'start')).toBeCloseTo(122.5)
    expect(swipeThreshold(350, 'end')).toBe(140)
    expect(swipeThreshold(100, 'end')).toBe(64)
    expect(swipeCommit(-140, 0, 350)).toBe('end')
    expect(swipeCommit(-130, 0, 350)).toBeNull()
    expect(swipeCommit(123, 0, 350)).toBe('start')
    expect(swipeCommit(-72, -0.9, 350)).toBe('end')
    expect(swipeCommit(-60, -0.9, 350)).toBeNull()
    expect(swipeCommit(50, 0.9, 350)).toBe('start')
    expect(swipeCommit(-80, 0.9, 350)).toBeNull()
    expect(swipeCommit(40, 2, 350)).toBeNull()
    expect(swipeCommit(0, 0, 350)).toBeNull()
  })

  it('adds resistance beyond 60% of the row width', () => {
    expect(swipeOffset(-200, 400)).toBe(-200)
    expect(swipeOffset(340, 400)).toBe(240 + 40)
    expect(swipeOffset(-340, 400)).toBe(-280)
  })

  it('measures velocity over the recent window', () => {
    const tracker = createVelocityTracker(80)
    expect(tracker.velocity()).toBe(0)
    tracker.add(0, 0)
    tracker.add(10, 300)
    tracker.add(70, 350)
    expect(tracker.velocity()).toBeCloseTo(1.2)
    tracker.add(80, 420)
    expect(tracker.velocity()).toBeCloseTo(10 / 70)
    tracker.reset()
    tracker.add(5, 500)
    expect(tracker.velocity()).toBe(0)
  })
})
