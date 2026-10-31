import { ensureToken } from '../auth/googleAuth'
import { downloadFileAsBlob, trashFile, updateBlob, uploadBlob } from '../drive/driveImageClient'
import { encodeGif } from '../../lib/image/gifEncoder'
import { mapWithConcurrency } from '../../lib/async/mapWithConcurrency'
import { gifSignature, sortFrames } from './sequenceFrames'
import { gifFileName } from './sequenceNaming'
import { getFolderIds } from './upload'
import type { Secuencia } from './secuencias'

export type GifRefreshStage = 'loading' | 'encoding' | 'uploading'

export interface RefreshGifOptions {
  onProgress?: (done: number, total: number) => void
  onStage?: (stage: GifRefreshStage) => void
  cachedBlobs?: Map<string, Blob>
}

export interface RefreshGifResult {
  mainFileId: string
  signature: string
}

export async function refreshSequenceGif(
  sequence: Secuencia,
  options: RefreshGifOptions = {},
): Promise<RefreshGifResult> {
  const frames = sortFrames(sequence.frames)
  if (frames.length === 0) throw new Error('No frames to encode')

  const token = await ensureToken()
  const folders = await getFolderIds(token)
  const cache = options.cachedBlobs
  let done = 0
  options.onProgress?.(0, frames.length)
  options.onStage?.('loading')

  const blobs = await mapWithConcurrency(frames, 3, async (frame) => {
    const cached = cache?.get(frame.id)
    if (cached) {
      done += 1
      options.onProgress?.(done, frames.length)
      return cached
    }
    const blob = await downloadFileAsBlob(token, frame.drive.galeriaId)
    cache?.set(frame.id, blob)
    done += 1
    options.onProgress?.(done, frames.length)
    return blob
  })

  options.onStage?.('encoding')
  const gifBlob = await encodeGif(blobs, sequence.fps, sequence.bucle)
  options.onStage?.('uploading')

  const signature = gifSignature(sequence)
  let mainFileId = sequence.mainFileId

  if (mainFileId) {
    try {
      await updateBlob(token, mainFileId, gifBlob)
    } catch {
      const previousId = mainFileId
      const uploaded = await uploadBlob(token, gifBlob, gifFileName(sequence.titulo, sequence.id), [folders.inboxId], {
        kind: 'secuencia',
        id: sequence.id,
      })
      mainFileId = uploaded.id
      await trashFile(token, previousId).catch(() => undefined)
    }
  } else {
    const uploaded = await uploadBlob(token, gifBlob, gifFileName(sequence.titulo, sequence.id), [folders.inboxId], {
      kind: 'secuencia',
      id: sequence.id,
    })
    mainFileId = uploaded.id
  }

  return { mainFileId, signature }
}
