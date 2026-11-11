const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
]

export interface SequenceVideo {
  blob: Blob
  mime: string
  extension: 'mp4' | 'webm'
}

export interface SequenceVideoOptions {
  background?: 'black' | 'white'
  width?: number
  height?: number
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function even(value: number): number {
  return Math.max(2, value - (value % 2))
}

function clampDimension(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(240, Math.min(3840, Math.round(value)))
}

function isSupported(type: string): boolean {
  try {
    return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
  } catch {
    return false
  }
}

export function pickVideoMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const type of VIDEO_MIME_CANDIDATES) {
    if (isSupported(type)) return type
  }
  return ''
}

export function videoExtension(mime: string): 'mp4' | 'webm' {
  return mime.includes('mp4') ? 'mp4' : 'webm'
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  background: 'black' | 'white',
): void {
  ctx.fillStyle = background === 'white' ? '#fff' : '#000'
  ctx.fillRect(0, 0, width, height)
  const scale = Math.min(width / bitmap.width, height / bitmap.height)
  const drawWidth = Math.max(1, Math.round(bitmap.width * scale))
  const drawHeight = Math.max(1, Math.round(bitmap.height * scale))
  const x = Math.round((width - drawWidth) / 2)
  const y = Math.round((height - drawHeight) / 2)
  ctx.drawImage(bitmap, x, y, drawWidth, drawHeight)
}

async function record(
  canvas: HTMLCanvasElement,
  bitmaps: ImageBitmap[],
  fps: number,
  mime: string | undefined,
  background: 'black' | 'white',
  onProgress?: (done: number, total: number) => void,
): Promise<SequenceVideo> {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')

  const frameMs = 1000 / fps
  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: BlobPart[] = []

  try {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve()
      recorder.onerror = () => reject(new Error('Video recording failed'))
    })

    drawFrame(ctx, bitmaps[0], canvas.width, canvas.height, background)
    recorder.start()
    onProgress?.(0, bitmaps.length)
    await wait(frameMs)
    onProgress?.(1, bitmaps.length)

    for (let index = 1; index < bitmaps.length; index += 1) {
      drawFrame(ctx, bitmaps[index], canvas.width, canvas.height, background)
      await wait(frameMs)
      onProgress?.(index + 1, bitmaps.length)
    }

    recorder.stop()
    await stopped

    if (chunks.length === 0) throw new Error('Video recording failed')
    const type = recorder.mimeType || mime || 'video/webm'
    return {
      blob: new Blob(chunks, { type }),
      mime: type,
      extension: videoExtension(type),
    }
  } finally {
    stream.getTracks().forEach((track) => track.stop())
  }
}

export async function exportSequenceVideo(
  frames: Blob[],
  fps: number,
  onProgress?: (done: number, total: number) => void,
  options: SequenceVideoOptions = {},
): Promise<SequenceVideo> {
  if (frames.length === 0) throw new Error('No frames to export')
  if (
    typeof document === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    typeof HTMLCanvasElement.prototype.captureStream !== 'function'
  ) {
    throw new Error('Video recording unavailable')
  }

  const bitmaps = await Promise.all(frames.map((blob) => createImageBitmap(blob)))
  const canvas = document.createElement('canvas')
  const safeFps = Math.max(1, Math.min(24, fps))

  try {
    const first = bitmaps[0]
    const background = options.background === 'white' ? 'white' : 'black'
    canvas.width = even(clampDimension(options.width, first.width))
    canvas.height = even(clampDimension(options.height, first.height))

    const supported = VIDEO_MIME_CANDIDATES.filter(isSupported)
    const candidates: (string | undefined)[] = [...supported, undefined]
    let lastError: unknown = null

    for (const mime of candidates) {
      try {
        return await record(canvas, bitmaps, safeFps, mime, background, onProgress)
      } catch (error) {
        lastError = error
      }
    }

    console.error('Video recording failed for every format', lastError)
    throw new Error('Video recording failed')
  } finally {
    for (const bitmap of bitmaps) bitmap.close()
    canvas.width = 0
    canvas.height = 0
  }
}
