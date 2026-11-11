export const MIN_HOLD = 1
export const MAX_HOLD = 12

export type PlaybackMode = 'loop' | 'once' | 'pingpong'
export type PlaybackSpeed = 0.5 | 1 | 2

export interface LoopRange {
  start: number
  end: number
}

export interface Exposure {
  ticks: number[]
  firstTickByFrame: number[]
}

export function clampHold(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return MIN_HOLD
  return Math.max(MIN_HOLD, Math.min(MAX_HOLD, Math.round(value)))
}

export function normalizeRange(range: LoopRange | undefined, frameCount: number): LoopRange | null {
  if (frameCount <= 0 || !range) return null
  const start = Math.max(0, Math.min(frameCount - 1, Math.round(Math.min(range.start, range.end))))
  const end = Math.max(0, Math.min(frameCount - 1, Math.round(Math.max(range.start, range.end))))
  if (start === 0 && end === frameCount - 1) return null
  return { start, end }
}

export function buildExposure(frameHolds: number[], range?: LoopRange | null): Exposure {
  const start = range ? Math.max(0, range.start) : 0
  const end = range ? Math.min(frameHolds.length - 1, range.end) : frameHolds.length - 1
  const ticks: number[] = []
  const firstTickByFrame = new Array<number>(frameHolds.length).fill(-1)

  for (let index = start; index <= end; index += 1) {
    firstTickByFrame[index] = ticks.length
    const hold = clampHold(frameHolds[index])
    for (let repeat = 0; repeat < hold; repeat += 1) ticks.push(index)
  }

  return { ticks, firstTickByFrame }
}

export function totalTicks(frameHolds: number[], range?: LoopRange | null): number {
  return buildExposure(frameHolds, range).ticks.length
}

export interface AdvanceResult {
  tick: number
  direction: 1 | -1
  stopped: boolean
}

export function nextTick(
  tick: number,
  tickCount: number,
  mode: PlaybackMode,
  direction: 1 | -1,
): AdvanceResult {
  if (tickCount <= 0) return { tick: 0, direction, stopped: true }

  const candidate = tick + direction

  if (mode === 'loop') {
    return { tick: (candidate + tickCount) % tickCount, direction, stopped: false }
  }

  if (mode === 'pingpong') {
    if (tickCount === 1) return { tick: 0, direction, stopped: true }
    if (candidate >= tickCount) return { tick: tickCount - 2, direction: -1, stopped: false }
    if (candidate < 0) return { tick: 1, direction: 1, stopped: false }
    return { tick: candidate, direction, stopped: false }
  }

  if (candidate >= tickCount) return { tick: tickCount - 1, direction, stopped: true }
  if (candidate < 0) return { tick: 0, direction: 1, stopped: false }
  return { tick: candidate, direction, stopped: false }
}

export function stepFrameIndex(
  current: number,
  frameCount: number,
  delta: number,
  range?: LoopRange | null,
): number {
  if (frameCount <= 0) return 0
  const start = range ? Math.max(0, Math.min(frameCount - 1, range.start)) : 0
  const end = range ? Math.max(0, Math.min(frameCount - 1, range.end)) : frameCount - 1
  const size = end - start + 1
  const normalized = Math.max(start, Math.min(end, current))
  const offset = (((normalized - start + delta) % size) + size) % size
  return start + offset
}

export function firstTickForFrame(exposure: Exposure, frameIndex: number): number {
  if (exposure.ticks.length === 0) return 0
  const tick = exposure.firstTickByFrame[frameIndex]
  if (tick === undefined || tick < 0) return 0
  return tick
}
