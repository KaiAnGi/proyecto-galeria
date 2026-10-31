import { useCallback, useEffect, useRef, useState } from 'react'

export function advanceFrame(index: number, frameCount: number, loop: boolean): number | null {
  if (frameCount <= 0) return null
  const next = index + 1
  if (next < frameCount) return next
  return loop ? 0 : null
}

interface SequencePlayerOptions {
  frameCount: number
  fps: number
  loop: boolean
}

export function useSequencePlayer({ frameCount, fps, loop }: SequencePlayerOptions) {
  const [index, setIndexState] = useState(0)
  const [playing, setPlaying] = useState(false)
  const indexRef = useRef(0)

  const setIndex = useCallback(
    (value: number) => {
      const clamped = Math.max(0, Math.min(frameCount - 1, value))
      indexRef.current = clamped
      setIndexState(clamped)
    },
    [frameCount],
  )

  useEffect(() => {
    if (frameCount === 0) {
      setPlaying(false)
      setIndexState(0)
      indexRef.current = 0
      return
    }
    if (indexRef.current >= frameCount) setIndex(frameCount - 1)
  }, [frameCount, setIndex])

  useEffect(() => {
    if (!playing || frameCount === 0) return
    let frameRequest = 0
    let last = performance.now()
    let accumulated = 0
    let stopped = false
    const frameMs = 1000 / Math.max(1, Math.min(24, fps))

    const tick = (now: number) => {
      accumulated += now - last
      last = now
      while (accumulated >= frameMs) {
        accumulated -= frameMs
        const next = advanceFrame(indexRef.current, frameCount, loop)
        if (next === null) {
          stopped = true
          setPlaying(false)
          break
        }
        indexRef.current = next
        setIndexState(next)
      }
      if (stopped) return
      frameRequest = requestAnimationFrame(tick)
    }

    frameRequest = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRequest)
  }, [playing, frameCount, fps, loop])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const play = useCallback(() => {
    if (frameCount === 0) return
    if (!loop && indexRef.current >= frameCount - 1) setIndex(0)
    setPlaying(true)
  }, [frameCount, loop, setIndex])

  const pause = useCallback(() => setPlaying(false), [])

  const toggle = useCallback(() => {
    if (playing) setPlaying(false)
    else play()
  }, [playing, play])

  const step = useCallback(
    (delta: number) => {
      setPlaying(false)
      if (frameCount === 0) return
      setIndex((indexRef.current + delta + frameCount) % frameCount)
    },
    [frameCount, setIndex],
  )

  const seek = useCallback(
    (value: number) => {
      setIndex(value)
    },
    [setIndex],
  )

  return {
    index,
    playing,
    play,
    pause,
    toggle,
    step,
    seek,
    setPlaying,
  }
}
