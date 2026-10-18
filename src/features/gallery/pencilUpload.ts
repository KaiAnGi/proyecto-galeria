import { ulid } from 'ulidx'
import { fileToBitmap, resizeToMaxDimensions, createMiniDataUrl, determineMime } from '../../lib/image/imageProcessor'
import { uploadBlob } from '../drive/driveImageClient'
import { getFolderIds } from './upload'
import { getToken } from '../auth/googleAuth'
import type { Frame } from './secuencias'

export interface UploadedFrame extends Frame {
  miniDataUrl: string
}

export async function uploadFrames(files: File[]): Promise<UploadedFrame[]> {
  const token = getToken()
  if (!token) throw new Error('No hay token')
  const folders = await getFolderIds(token)
  const frames: UploadedFrame[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const bmp = await fileToBitmap(file)
    const id = ulid()
    const galeriaBlob = await resizeToMaxDimensions(bmp, 2400, 'image/webp', 0.85)
    const galeriaMime = determineMime(galeriaBlob.type)
    const galeriaBlobFinal = galeriaMime === 'image/webp' ? galeriaBlob : await resizeToMaxDimensions(bmp, 2400, 'image/jpeg', 0.85)
    const miniDataUrl = await createMiniDataUrl(bmp, 480, 0.8)
    const miniBlob = await (await fetch(miniDataUrl)).blob()
    await uploadBlob(token, miniBlob, `${id}-mini.webp`, [folders.miniaturasId], { kind: 'miniatura', frameId: id })
    const originalName = `${id}-original`
    const galeriaNameFinal = galeriaBlobFinal.type.includes('jpeg') || galeriaBlobFinal.type.includes('jpg') ? `${id}.jpg` : `${id}.webp`
    const upOrig = await uploadBlob(token, originalBlobLike(file), originalName, [folders.originalesId], { kind: 'original', frameId: id })
    const upGal = await uploadBlob(token, galeriaBlobFinal, galeriaNameFinal, [folders.galeriaId], { kind: 'frame', frameId: id })
    frames.push({
      id,
      orden: i,
      drive: { originalId: upOrig.id, galeriaId: upGal.id },
      miniDataUrl,
    })
  }
  return frames
}

function originalBlobLike(file: File): Blob {
  return file
}
