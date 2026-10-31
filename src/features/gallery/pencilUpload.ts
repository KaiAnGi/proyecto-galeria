import { ulid } from 'ulidx'
import { fileToBitmap, imageExtension, processImage } from '../../lib/image/imageProcessor'
import type { ProcessedImage } from '../../lib/image/imageProcessor'
import { encodeGif } from '../../lib/image/gifEncoder'
import { uploadBlob } from '../drive/driveImageClient'
import { getFolderIds } from './upload'
import { ensureToken } from '../auth/googleAuth'
import { mapWithConcurrency } from '../../lib/async/mapWithConcurrency'
import { gifFileName } from './sequenceNaming'
import type { Frame, Secuencia } from './secuencias'

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
  loop?: boolean
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

export interface UploadedAppendedFrames {
  frames: UploadedFrame[]
  uploadOriginals: (options?: UploadOriginalsOptions) => Promise<UploadOriginalsResult>
}

interface ProcessedFrame {
  frame: UploadedFrame
  galleryBlob: Blob
  file: File
}

interface FolderIds {
  originalesId: string
  galeriaId: string
  inboxId: string
}

async function processFrameFiles(
  files: File[],
  startOrder: number,
  includeFirstMini: boolean,
  onProgress?: (done: number, total: number) => void,
  onStage?: (stage: UploadStage) => void,
): Promise<{ processed: ProcessedFrame[]; folders: FolderIds }> {
  if (files.length === 0) throw new Error('No frames to upload')

  const token = await ensureToken()
  const folderIds = await getFolderIds(token)
  onStage?.('frames')
  onProgress?.(0, files.length)

  let done = 0
  const processed = await mapWithConcurrency(files, FRAME_CONCURRENCY, async (file, index) => {
    const frameToken = await ensureToken()
    const bmp = await fileToBitmap(file)

    try {
      const includeMini = includeFirstMini && index === 0
      const image = includeMini
        ? await processImage(bmp, FRAME_MAX_SIDE, FRAME_QUALITY)
        : await processImage(bmp, FRAME_MAX_SIDE, FRAME_QUALITY, false)
      const id = ulid()
      const galeriaName = `${id}.${imageExtension(image.galleryBlob)}`
      const upGal = await uploadBlob(frameToken, image.galleryBlob, galeriaName, [folderIds.galeriaId], {
        kind: 'frame',
        frameId: id,
      })

      done += 1
      onProgress?.(done, files.length)

      const frame: UploadedFrame = { id, orden: startOrder + index, drive: { galeriaId: upGal.id } }
      if (includeMini) frame.miniDataUrl = (image as ProcessedImage).miniDataUrl

      return { frame, galleryBlob: image.galleryBlob, file }
    } finally {
      bmp.close()
    }
  })

  return {
    processed,
    folders: {
      originalesId: folderIds.originalesId,
      galeriaId: folderIds.galeriaId,
      inboxId: folderIds.inboxId,
    },
  }
}

function uploadOriginalsFor(
  frames: UploadedFrame[],
  filesById: Map<string, File>,
  originalsFolderId: string,
  options: UploadOriginalsOptions = {},
): Promise<UploadOriginalsResult> {
  const total = frames.length
  let uploaded = 0
  let failed = 0
  options.onProgress?.(0, total)

  return mapWithConcurrency(frames, ORIGINAL_CONCURRENCY, async (frame) => {
    if (options.shouldContinue && !options.shouldContinue()) return frame

    const file = filesById.get(frame.id)
    if (!file) return frame

    try {
      const frameToken = await ensureToken()
      const up = await uploadBlob(frameToken, file, `${frame.id}-original`, [originalsFolderId], {
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
  }).then((results) => ({ failed, frames: results }))
}

export async function uploadFrames(
  files: File[],
  options: UploadFramesOptions,
  onProgress?: (done: number, total: number) => void,
  onStage?: (stage: UploadStage) => void,
): Promise<UploadedFrames> {
  const { processed, folders } = await processFrameFiles(files, 0, true, onProgress, onStage)

  onStage?.('gif')
  const gifBlob = await encodeGif(
    processed.map((item) => item.galleryBlob),
    options.fps,
    options.loop ?? true,
  )
  const upGif = await uploadBlob(
    await ensureToken(),
    gifBlob,
    gifFileName(options.titulo, options.id),
    [folders.inboxId],
    {
      kind: 'secuencia',
      id: options.id,
    },
  )

  const frames = processed.map((item) => item.frame)
  const filesById = new Map(processed.map((item) => [item.frame.id, item.file]))

  return {
    frames,
    mainFileId: upGif.id,
    uploadOriginals: (originalOptions) =>
      uploadOriginalsFor(frames, filesById, folders.originalesId, originalOptions),
  }
}

export async function uploadAppendedFrames(
  sequence: Secuencia,
  files: File[],
  onProgress?: (done: number, total: number) => void,
  onStage?: (stage: UploadStage) => void,
): Promise<UploadedAppendedFrames> {
  const { processed, folders } = await processFrameFiles(
    files,
    sequence.frames.length,
    sequence.frames.length === 0,
    onProgress,
    onStage,
  )
  const frames = processed.map((item) => item.frame)
  const filesById = new Map(processed.map((item) => [item.frame.id, item.file]))

  return {
    frames,
    uploadOriginals: (originalOptions) =>
      uploadOriginalsFor(frames, filesById, folders.originalesId, originalOptions),
  }
}
