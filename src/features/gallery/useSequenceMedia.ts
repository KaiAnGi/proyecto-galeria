import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { downloadFileAsBlob } from '../drive/driveImageClient'
import { mapWithConcurrency } from '../../lib/async/mapWithConcurrency'
import { sortFrames } from './sequenceFrames'
import type { Frame } from './secuencias'

export type FrameMediaStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface FrameMedia {
  url?: string
  status: FrameMediaStatus
}

function prioritizeFrames(frames: Frame[], currentId: string | undefined): Frame[] {
  const sorted = sortFrames(frames)
  const currentIndex = currentId ? sorted.findIndex((frame) => frame.id === currentId) : -1
  if (currentIndex < 0) return sorted

  const ordered: Frame[] = [sorted[currentIndex]]
  for (let distance = 1; distance < sorted.length; distance += 1) {
    const previous = sorted[currentIndex - distance]
    const next = sorted[currentIndex + distance]
    if (previous) ordered.push(previous)
    if (next) ordered.push(next)
    if (ordered.length === sorted.length) break
  }
  return ordered
}

export function useSequenceMedia(
  frames: Frame[],
  currentFrameId: string | undefined,
): Record<string, FrameMedia> {
  const { token } = useAuth()
  const urls = useRef(new Map<string, string>())
  const inFlight = useRef(new Set<string>())
  const failed = useRef(new Set<string>())
  const [loaded, setLoaded] = useState<Record<string, FrameMedia>>({})

  useEffect(() => {
    if (!token) return
    const ordered = prioritizeFrames(frames, currentFrameId)
    const sorted = sortFrames(frames)
    const currentIndex = currentFrameId ? sorted.findIndex((frame) => frame.id === currentFrameId) : -1
    const priorityIds =
      currentIndex >= 0
        ? new Set(
            [sorted[currentIndex - 1], sorted[currentIndex], sorted[currentIndex + 1]]
              .filter((frame): frame is Frame => Boolean(frame))
              .map((frame) => frame.id),
          )
        : new Set<string>()
    const priority = ordered.filter((frame) => priorityIds.has(frame.id))
    const rest = ordered.filter((frame) => !priorityIds.has(frame.id))

    const load = (list: Frame[]) =>
      mapWithConcurrency(list, 3, async (frame) => {
        if (urls.current.has(frame.id) || inFlight.current.has(frame.id) || failed.current.has(frame.id)) return
        inFlight.current.add(frame.id)
        setLoaded((current) => ({ ...current, [frame.id]: { status: 'loading' } }))
        try {
          const blob = await downloadFileAsBlob(token, frame.drive.galeriaId)
          const url = URL.createObjectURL(blob)
          urls.current.set(frame.id, url)
          setLoaded((current) => ({ ...current, [frame.id]: { url, status: 'ready' } }))
        } catch {
          failed.current.add(frame.id)
          setLoaded((current) => ({ ...current, [frame.id]: { status: 'error' } }))
        } finally {
          inFlight.current.delete(frame.id)
        }
      })

    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) void load(rest)
    }, 300)
    void load(priority).then(() => {
      if (cancelled) return
      clearTimeout(timer)
      void load(rest)
    })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [token, frames, currentFrameId])

  useEffect(
    () => () => {
      for (const url of urls.current.values()) URL.revokeObjectURL(url)
      urls.current.clear()
      inFlight.current.clear()
      failed.current.clear()
    },
    [],
  )

  return useMemo(() => {
    const media: Record<string, FrameMedia> = {}
    for (const frame of frames) {
      media[frame.id] = loaded[frame.id] ?? { status: 'idle' }
    }
    return media
  }, [frames, loaded])
}
