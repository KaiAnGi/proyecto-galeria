export type MediaKind = 'imagen' | 'gif' | 'video' | 'otro'

const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.mov', '.webm']

export function classifyFile(file: { type: string; name?: string }): MediaKind {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/gif') return 'gif'
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('image/')) return 'imagen'
  const name = (file.name || '').toLowerCase()
  if (VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext))) return 'video'
  return 'otro'
}

export function isPlayableVideoMime(mime: string): boolean {
  const m = (mime || '').toLowerCase()
  return m.startsWith('video/mp4') || m.startsWith('video/webm')
}

export function frameStepSeconds(fps: number): number {
  const safe = Math.min(60, Math.max(1, fps || 30))
  return 1 / safe
}

export async function getVideoThumbnail(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve()
      video.onerror = () => reject(new Error('No se pudo leer el vídeo'))
      video.load()
    })
    await new Promise<void>((resolve) => {
      const done = () => resolve()
      video.onseeked = done
      const target = Math.min(0.1, Number.isFinite(video.duration) ? video.duration : 0.1)
      try {
        video.currentTime = target
      } catch {
        resolve()
      }
    })
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Sin canvas')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.7)
  } finally {
    URL.revokeObjectURL(url)
  }
}
