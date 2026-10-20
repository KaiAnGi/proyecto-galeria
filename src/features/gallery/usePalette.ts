import { useMemo } from 'react'
import { extractPalette } from '../../lib/color/palette'

export function usePalette(img: HTMLImageElement | null): string[] {
  return useMemo(() => {
    if (!img) return []
    try {
      return extractPalette(img)
    } catch {
      return []
    }
  }, [img])
}
