import { describe, expect, it } from 'vitest'
import {
  buildExposure,
  clampHold,
  firstTickForFrame,
  nextTick,
  normalizeRange,
  stepFrameIndex,
  totalTicks,
} from './frameTiming'

describe('frameTiming', () => {
  it('clamps holds to a sane range', () => {
    expect(clampHold(undefined)).toBe(1)
    expect(clampHold(0)).toBe(1)
    expect(clampHold(2.4)).toBe(2)
    expect(clampHold(99)).toBe(12)
    expect(clampHold(Number.NaN)).toBe(1)
  })

  it('normalizes loop ranges against the frame count', () => {
    expect(normalizeRange(undefined, 5)).toBeNull()
    expect(normalizeRange({ start: 0, end: 4 }, 5)).toBeNull()
    expect(normalizeRange({ start: 3, end: 1 }, 5)).toEqual({ start: 1, end: 3 })
    expect(normalizeRange({ start: -3, end: 99 }, 5)).toBeNull()
    expect(normalizeRange({ start: -3, end: 2 }, 5)).toEqual({ start: 0, end: 2 })
  })

  it('builds exposures that repeat frames according to their hold', () => {
    const exposure = buildExposure([1, 2, 1])

    expect(exposure.ticks).toEqual([0, 1, 1, 2])
    expect(exposure.firstTickByFrame).toEqual([0, 1, 3])
    expect(totalTicks([1, 2, 1])).toBe(4)
  })

  it('respects an explicit range', () => {
    const exposure = buildExposure([1, 1, 1, 1], { start: 1, end: 2 })

    expect(exposure.ticks).toEqual([1, 2])
    expect(exposure.firstTickByFrame[0]).toBe(-1)
    expect(firstTickForFrame(exposure, 2)).toBe(1)
  })

  it('loops, stops once and bounces with ping-pong', () => {
    expect(nextTick(2, 3, 'loop', 1)).toEqual({ tick: 0, direction: 1, stopped: false })
    expect(nextTick(1, 3, 'once', 1)).toEqual({ tick: 2, direction: 1, stopped: false })
    expect(nextTick(2, 3, 'once', 1)).toEqual({ tick: 2, direction: 1, stopped: true })
    expect(nextTick(2, 3, 'pingpong', 1)).toEqual({ tick: 1, direction: -1, stopped: false })
    expect(nextTick(0, 3, 'pingpong', -1)).toEqual({ tick: 1, direction: 1, stopped: false })
    expect(nextTick(0, 1, 'pingpong', 1)).toEqual({ tick: 0, direction: 1, stopped: true })
  })

  it('steps between source frames and wraps inside the range', () => {
    expect(stepFrameIndex(0, 5, 1)).toBe(1)
    expect(stepFrameIndex(4, 5, 1)).toBe(0)
    expect(stepFrameIndex(0, 5, -1)).toBe(4)
    expect(stepFrameIndex(2, 5, 1, { start: 1, end: 3 })).toBe(3)
    expect(stepFrameIndex(3, 5, 1, { start: 1, end: 3 })).toBe(1)
    expect(stepFrameIndex(99, 5, 0)).toBe(4)
  })
})
