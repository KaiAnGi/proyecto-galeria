import { applyPalette, GIFEncoder, quantize } from 'gifenc'

const MAX_GIF_SIDE = 720

export async function encodeGif(frames: Blob[], fps: number): Promise<Blob> {
  if (frames.length === 0) throw new Error('No frames to encode')

  const bitmaps = await Promise.all(frames.map((blob) => createImageBitmap(blob)))
  const first = bitmaps[0]
  const scale = Math.min(1, MAX_GIF_SIDE / Math.max(first.width, first.height))
  const width = Math.max(1, Math.round(first.width * scale))
  const height = Math.max(1, Math.round(first.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas context unavailable')

  try {
    const gif = GIFEncoder()
    const delay = Math.round(1000 / Math.min(24, Math.max(1, fps)))

    for (const bitmap of bitmaps) {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(bitmap, 0, 0, width, height)
      const { data } = ctx.getImageData(0, 0, width, height)
      const palette = quantize(data, 256)
      const index = applyPalette(data, palette)
      gif.writeFrame(index, width, height, { palette, delay, repeat: 0 })
    }

    gif.finish()
    return new Blob([gif.bytes()], { type: 'image/gif' })
  } finally {
    for (const bitmap of bitmaps) bitmap.close()
    canvas.width = 0
    canvas.height = 0
  }
}
