import { ensureToken } from '../auth/googleAuth'
import { downloadFileAsBlob } from '../drive/driveImageClient'
import { blobToThumbnailDataUrl } from '../../lib/image/imageProcessor'
import { sortFrames } from './sequenceFrames'
import { useGalleryStore } from './store'
import { persistLatestSequence } from './sequenceSave'

export async function refreshSequenceCover(sequenceId: string): Promise<void> {
  const sequence = useGalleryStore.getState().secuencias.find((item) => item.id === sequenceId)
  if (!sequence) return
  const first = sortFrames(sequence.frames)[0]
  if (!first) return

  try {
    const token = await ensureToken()
    const blob = await downloadFileAsBlob(token, first.drive.galeriaId)
    const miniatura = await blobToThumbnailDataUrl(blob)
    const latest = useGalleryStore.getState().secuencias.find((item) => item.id === sequenceId)
    if (!latest) return
    const latestFirst = sortFrames(latest.frames)[0]
    if (latestFirst?.id !== first.id) return
    useGalleryStore.getState().updateSecuencia(sequenceId, { miniatura })
    persistLatestSequence(sequenceId)
  } catch {
    return
  }
}
