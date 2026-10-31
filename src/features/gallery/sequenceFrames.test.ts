import { describe, expect, it } from 'vitest'
import type { Frame } from './secuencias'
import {
  appendFrames,
  gifSignature,
  moveFrame,
  normalizeFrames,
  removeFrame,
  sequenceDuration,
  sortFrames,
} from './sequenceFrames'

function frame(id: string, orden: number): Frame {
  return { id, orden, drive: { galeriaId: `gal-${id}` } }
}

describe('sequenceFrames', () => {
  it('sorts and normalizes frame order', () => {
    const frames = [frame('b', 4), frame('a', 2), frame('c', 7)]

    expect(sortFrames(frames).map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(normalizeFrames(frames).map((item) => item.orden)).toEqual([0, 1, 2])
  })

  it('moves a frame without mutating the source', () => {
    const frames = [frame('a', 0), frame('b', 1), frame('c', 2)]

    const moved = moveFrame(frames, 2, 0)

    expect(moved.map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(moved.map((item) => item.orden)).toEqual([0, 1, 2])
    expect(frames.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('ignores moves outside the sequence', () => {
    const frames = [frame('a', 0), frame('b', 1)]

    expect(moveFrame(frames, 0, -1).map((item) => item.id)).toEqual(['a', 'b'])
    expect(moveFrame(frames, 0, 5).map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('appends and renumbers added frames', () => {
    const result = appendFrames([frame('a', 0)], [frame('b', 9), frame('c', 10)])

    expect(result.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(result.map((item) => item.orden)).toEqual([0, 1, 2])
  })

  it('removes a frame and keeps a compact order', () => {
    const result = removeFrame([frame('a', 0), frame('b', 1), frame('c', 2)], 'b')

    expect(result.map((item) => item.id)).toEqual(['a', 'c'])
    expect(result.map((item) => item.orden)).toEqual([0, 1])
  })

  it('calculates duration and clamps invalid fps', () => {
    expect(sequenceDuration([], 12)).toBe(0)
    expect(sequenceDuration([frame('a', 0), frame('b', 1)], 12)).toBeCloseTo(1 / 6)
    expect(sequenceDuration([frame('a', 0)], 0)).toBe(1)
  })

  it('builds a signature that changes with fps, loop or frame order', () => {
    const frames = [frame('a', 0), frame('b', 1)]

    expect(gifSignature({ fps: 12, bucle: true, frames })).toBe('12:1:a@0,b@1')
    expect(gifSignature({ fps: 24, bucle: true, frames })).not.toBe(
      gifSignature({ fps: 12, bucle: true, frames }),
    )
    expect(gifSignature({ fps: 12, bucle: false, frames })).not.toBe(
      gifSignature({ fps: 12, bucle: true, frames }),
    )
    expect(gifSignature({ fps: 12, bucle: true, frames: moveFrame(frames, 0, 1) })).not.toBe(
      gifSignature({ fps: 12, bucle: true, frames }),
    )
  })
})
