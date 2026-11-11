import { useEffect, useMemo, useRef, useState } from 'react'
import { loadImage } from '../../lib/image/imageProcessor'
import type { FrameMedia } from './useSequenceMedia'

interface CachedImage {
  url: string
  image: HTMLImageElement
}

export function useFrameImages(
  media: Record<string, FrameMedia>,
  ids: (string | undefined)[],
  maxCached = 16,
): Record<string, HTMLImageElement> {
  const cacheRef = useRef(new Map<string, CachedImage>())
  const inFlight = useRef(new Set<string>())
  const idsRef = useRef(ids)
  idsRef.current = ids
  const [version, setVersion] = useState(0)
  const idsKey = ids.filter((id): id is string => Boolean(id)).join('|')

  useEffect(() => {
    let cancelled = false

    for (const id of idsRef.current) {
      if (!id || inFlight.current.has(id)) continue
      const item = media[id]
      if (!item?.url) continue
      const cached = cacheRef.current.get(id)
      if (cached?.url === item.url) continue
      if (cached) cacheRef.current.delete(id)

      const url = item.url
      inFlight.current.add(id)
      void loadImage(url)
        .then((image) => {
          if (cancelled) return
          cacheRef.current.set(id, { url, image })
          trimCache(
            cacheRef.current,
            new Set(idsRef.current.filter((value): value is string => Boolean(value))),
            maxCached,
          )
          setVersion((value) => value + 1)
        })
        .catch(() => undefined)
        .finally(() => {
          inFlight.current.delete(id)
        })
    }

    return () => {
      cancelled = true
    }
  }, [idsKey, media, maxCached])

  useEffect(() => {
    const cache = cacheRef.current
    return () => {
      cache.clear()
    }
  }, [])

  return useMemo(() => {
    const images: Record<string, HTMLImageElement> = {}
    for (const id of idsRef.current) {
      if (!id) continue
      const cached = cacheRef.current.get(id)
      if (cached) images[id] = cached.image
    }
    return images
    // idsKey and version drive re-reads from the ref-held cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, version])
}

function trimCache(cache: Map<string, CachedImage>, keep: Set<string>, max: number): void {
  if (cache.size <= max) return
  for (const key of [...cache.keys()]) {
    if (cache.size <= max) break
    if (!keep.has(key)) cache.delete(key)
  }
}
