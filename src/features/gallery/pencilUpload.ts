import { ulid } from 'ulidx'
import { fileToBitmap, imageExtension, processImage } from '../../lib/image/imageProcessor'
import { uploadBlob } from '../drive/driveImageClient'
import { getFolderIds } from './upload'
import { ensureToken, getToken } from '../auth/googleAuth'
import type { Frame } from './secuencias'

export interface UploadedFrame extends Frame {
  miniDataUrl: string
}

export async function uploadFrames(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<UploadedFrame[]> {
  let token = await ensureToken()
  const folders = await getFolderIds(token)
  const frames: UploadedFrame[] = []

  for (let i = 0; i < files.length; i++) {
    if (!getToken()) token = await ensureToken()
    onProgress?.(i, files.length)

    const file = files[i]
    const bmp = await fileToBitmap(file)
    const id = ulid()

    try {
      const processed = await processImage(bmp)
      const originalName = `${id}-original`
      const galeriaNameFinal = `${id}.${imageExtension(processed.galleryBlob)}`
      const miniName = `${id}-mini.${imageExtension(processed.miniBlob)}`

      const [, upOrig, upGal] = await Promise.all([
        uploadBlob(token, processed.miniBlob, miniName, [folders.miniaturasId], { kind: 'miniatura', frameId: id }),
        uploadBlob(token, file, originalName, [folders.originalesId], { kind: 'original', frameId: id }),
        uploadBlob(
          token,
          processed.galleryBlob,
          galeriaNameFinal,
          [folders.galeriaId],
          { kind: 'frame', frameId: id },
        ),
      ])

      frames.push({
        id,
        orden: i,
        drive: { originalId: upOrig.id, galeriaId: upGal.id },
        miniDataUrl: processed.miniDataUrl,
      })
    } finally {
      bmp.close()
    }
  }
  return frames
}
