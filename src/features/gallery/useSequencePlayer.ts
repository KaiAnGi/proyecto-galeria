import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildExposure,
  firstTickForFrame,
  nextTick,
  stepFrameIndex,
  type LoopRange,
  type PlaybackMode,
  type PlaybackSpeed,
} from './frameTiming'

interface SequencePlayerOptions {
  frameHolds: number[]
  fps: number
  mode: PlaybackMode
  range?: LoopRange | null
  speed: PlaybackSpeed
  isReady?: (frameIndex: number) => boolean
}

function clampFps(fps: number): number {
  return Math.max(1, Math.min(24, fps))
}

export function useSequencePlayer({
  frameHolds,
  fps,
  mode,
  range,
  speed,
  isReady,
}: SequencePlayerOptions) {
  const holdsKey = frameHolds.join(',')
  const exposure = useMemo(
    () => buildExposure(frameHolds, range ?? null),
    // frameHolds is represented by its stable key; range is primitives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [holdsKey, range?.start, range?.end],
  )
  const tickCount = exposure.ticks.length
  const [tick, setTickState] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [waitingFor, setWaitingFor] = useState<number | null>(null)
  const tickRef = useRef(0)
  const directionRef = useRef<1 | -1>(1)
  const indexRef = useRef(0)
  const isReadyRef = useRef(isReady)
  isReadyRef.current = isReady

  const index = exposure.ticks[Math.min(tick, Math.max(0, tickCount - 1))] ?? 0

  const setTick = useCallback(
    (value: number) => {
      const clamped = Math.max(0, Math.min(tickCount - 1, value))
      tickRef.current = clamped
      setTickState(clamped)
    },
    [tickCount],
  )

  useEffect(() => {
    if (tickCount === 0) {
      tickRef.current = 0
      setTickState(0)
      setPlaying(false)
      setWaitingFor(null)
      return
    }

    const desired = indexRef.current
    const firstTick = desired >= 0 ? exposure.firstTickByFrame[desired] : -1
    const next = firstTick !== undefined && firstTick >= 0 ? firstTick : Math.min(tickRef.current, tickCount - 1)
    tickRef.current = next
    setTickState(next)
  }, [exposure, tickCount])

  useEffect(() => {
    indexRef.current = index
  }, [index])

  useEffect(() => {
    if (!playing || tickCount === 0) return
    let frameRequest = 0
    let last = performance.now()
    let accumulated = 0
    let stopped = false
    const frameMs = 1000 / (clampFps(fps) * speed)

    const tickFrame = (now: number) => {
      accumulated += now - last
      last = now
      let guard = 0

      while (accumulated >= frameMs && guard < 240) {
        guard += 1
        accumulated -= frameMs
        const currentTick = tickRef.current
        const currentFrame = exposure.ticks[currentTick]
        const result = nextTick(currentTick, tickCount, mode, directionRef.current)
        const nextFrame = exposure.ticks[result.tick]

        if (nextFrame !== currentFrame && isReadyRef.current && !isReadyRef.current(nextFrame)) {
          setWaitingFor(nextFrame)
          setPlaying(false)
          stopped = true
          break
        }

        directionRef.current = result.direction
        tickRef.current = result.tick
        setTickState(result.tick)

        if (result.stopped) {
          setPlaying(false)
          stopped = true
          break
        }
      }

      if (stopped) return
      frameRequest = requestAnimationFrame(tickFrame)
    }

    frameRequest = requestAnimationFrame(tickFrame)
    return () => cancelAnimationFrame(frameRequest)
  }, [playing, tickCount, fps, speed, mode, exposure])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const play = useCallback(() => {
    if (tickCount === 0) return
    if (mode === 'once' && tickRef.current >= tickCount - 1) {
      setTick(0)
      directionRef.current = 1
    }
    setWaitingFor(null)
    setPlaying(true)
  }, [mode, setTick, tickCount])

  const pause = useCallback(() => setPlaying(false), [])

  const toggle = useCallback(() => {
    if (playing) setPlaying(false)
    else play()
  }, [playing, play])

  const step = useCallback(
    (delta: number) => {
      setPlaying(false)
      setWaitingFor(null)
      if (tickCount === 0) return
      const target = stepFrameIndex(indexRef.current, frameHolds.length, delta, range ?? null)
      const targetTick = firstTickForFrame(exposure, target)
      setTick(targetTick)
    },
    [exposure, frameHolds.length, range, setTick, tickCount],
  )

  const seekFrame = useCallback(
    (frameIndex: number) => {
      setWaitingFor(null)
      if (tickCount === 0) return
      setTick(firstTickForFrame(exposure, frameIndex))
    },
    [exposure, setTick, tickCount],
  )

  const seekTick = useCallback(
    (value: number) => {
      setWaitingFor(null)
      setTick(value)
    },
    [setTick],
  )

  return {
    index,
    tick,
    tickCount,
    playing,
    waiting: waitingFor !== null,
    waitingFor,
    seekFrame,
    seekTick,
    play,
    pause,
    toggle,
    step,
  }
}
