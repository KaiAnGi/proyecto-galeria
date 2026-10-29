import { ulid } from 'ulidx'
import { fileToBitmap, imageExtension, processImage } from '../../lib/image/imageProcessor'
import type { ProcessedImage } from '../../lib/image/imageProcessor'
import { encodeGif } from '../../lib/image/gifEncoder'
import { uploadBlob } from '../drive/driveImageClient'
import { getFolderIds } from './upload'
import { ensureToken } from '../auth/googleAuth'
import { mapWithConcurrency } from '../../lib/async/mapWithConcurrency'
import type { Frame } from './secuencias'

const FRAME_MAX_SIDE = 1024
const FRAME_QUALITY = 0.72
const FRAME_CONCURRENCY = 3
const ORIGINAL_CONCURRENCY = 2

export type UploadStage = 'frames' | 'gif'

export interface UploadedFrame extends Frame {
  miniDataUrl?: string
}

export interface UploadFramesOptions {
  id: string
  titulo: string
  fps: number
}

export interface UploadOriginalsOptions {
  onProgress?: (done: number, total: number) => void
  onFrameUploaded?: (frameId: string, originalId: string) => void
  shouldContinue?: () => boolean
}

export interface UploadOriginalsResult {
  failed: number
  frames: UploadedFrame[]
}

export interface UploadedFrames {
  frames: UploadedFrame[]
  mainFileId: string
  uploadOriginals: (options?: UploadOriginalsOptions) => Promise<UploadOriginalsResult>
}

function safeFileName(title: string): string {
  const cleaned = title.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ')
  return cleaned.slice(0, 80) || 'Animación'
}

export async function uploadFrames(
  files: File[],
  options: UploadFramesOptions,
  onProgress?: (done: number, total: number) => void,
  onStage?: (stage: UploadStage) => void,
): Promise<UploadedFrames> {
  if (files.length === 0) throw new Error('No frames to upload')

  const token = await ensureToken()
  const folders = await getFolderIds(token)
  onStage?.('frames')
  onProgress?.(0, files.length)

  let done = 0
  const processed = await mapWithConcurrency(files, FRAME_CONCURRENCY, async (file, index) => {
    const frameToken = await ensureToken()
    const bmp = await fileToBitmap(file)

    try {
      const includeMini = index === 0
      const image = includeMini
        ? await processImage(bmp, FRAME_MAX_SIDE, FRAME_QUALITY)
        : await processImage(bmp, FRAME_MAX_SIDE, FRAME_QUALITY, false)
      const id = ulid()
      const galeriaName = `${id}.${imageExtension(image.galleryBlob)}`
      const upGal = await uploadBlob(frameToken, image.galleryBlob, galeriaName, [folders.galeriaId], {
        kind: 'frame',
        frameId: id,
      })

      done += 1
      onProgress?.(done, files.length)

      const frame: UploadedFrame = { id, orden: index, drive: { galeriaId: upGal.id } }
      if (includeMini) frame.miniDataUrl = (image as ProcessedImage).miniDataUrl

      return { frame, galleryBlob: image.galleryBlob }
    } finally {
      bmp.close()
    }
  })

  onStage?.('gif')
  const gifBlob = await encodeGif(
    processed.map((item) => item.galleryBlob),
    options.fps,
  )
  const gifName = `${safeFileName(options.titulo)} [${options.id.slice(-6)}].gif`
  const upGif = await uploadBlob(await ensureToken(), gifBlob, gifName, [folders.inboxId], {
    kind: 'secuencia',
    id: options.id,
  })

  const frames = processed.map((item) => item.frame)

  async function uploadOriginals(options: UploadOriginalsOptions = {}): Promise<UploadOriginalsResult> {
    const total = frames.length
    let uploaded = 0
    let failed = 0
    options.onProgress?.(0, total)

    const results = await mapWithConcurrency(frames, ORIGINAL_CONCURRENCY, async (frame) => {
      if (options.shouldContinue && !options.shouldContinue()) return frame

      try {
        const frameToken = await ensureToken()
        const up = await uploadBlob(frameToken, files[frame.orden], `${frame.id}-original`, [folders.originalesId], {
          kind: 'original',
          frameId: frame.id,
        })
        uploaded += 1
        options.onFrameUploaded?.(frame.id, up.id)
        return { ...frame, drive: { ...frame.drive, originalId: up.id } }
      } catch {
        failed += 1
        return frame
      } finally {
        options.onProgress?.(uploaded + failed, total)
      }
    })

    return { failed, frames: results }
  }

  return { frames, mainFileId: upGif.id, uploadOriginals }
}
