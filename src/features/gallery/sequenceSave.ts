import { blobToThumbnailDataUrl, imageExtension } from '../../lib/image/imageProcessor'
import { mapWithConcurrency } from '../../lib/async/mapWithConcurrency'
import { es } from '../../i18n/es'
import { ensureAnimationFolders } from '../drive/animationFolders'
import { addFilesToFolder } from '../drive/collectionFolders'
import { downloadFileAsBlob, trashFile, uploadBlob } from '../drive/driveImageClient'
import { saveSecuencia } from './persistence'
import { enqueueSave } from './saveQueue'
import { useGalleryStore } from './store'
import { withUpdatedAt, type Frame, type Secuencia } from './secuencias'
import { clampHold } from './frameTiming'
import { safeFileName } from './sequenceNaming'
import { sortDraftFrames, type SequenceDraft } from './sequenceDrafts'
import { exportSequenceVideo } from './sequenceVideo'

export type SequenceSaveStage = 'preparing' | 'video' | 'frames' | 'finishing'

export interface SequenceSaveProgress {
  stage: SequenceSaveStage
  done: number
  total: number
}

export interface SavedSequenceDraft {
  sequence: Secuencia
  frames: Frame[]
}

function fileExtension(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension && /^[a-z0-9]{1,5}$/.test(extension) ? extension : 'bin'
}

async function cleanupPrevious(
  token: string,
  previous: Secuencia | undefined,
  next: Secuencia,
): Promise<void> {
  if (!previous) return
  const nextIds = new Set(
    next.frames.flatMap((frame) => [frame.drive.originalId, frame.drive.galeriaId]).filter((id): id is string => Boolean(id)),
  )
  const removed = previous.frames
    .flatMap((frame) => [frame.drive.originalId, frame.drive.galeriaId])
    .filter((id): id is string => typeof id === 'string' && !nextIds.has(id))

  const ids = [...removed]
  if (previous.mainFileId && previous.mainFileId !== next.mainFileId && !nextIds.has(previous.mainFileId)) {
    ids.push(previous.mainFileId)
  }
  await Promise.allSettled(ids.map((fileId) => trashFile(token, fileId)))
}

export async function saveSequenceDraft(
  draft: SequenceDraft,
  onProgress?: (progress: SequenceSaveProgress) => void,
): Promise<SavedSequenceDraft> {
  const ordered = sortDraftFrames(draft.frames)
  if (ordered.length === 0) throw new Error('No frames to save')

  let result: SavedSequenceDraft | null = null
  const total = ordered.length
  const title = draft.titulo.trim() || es.pencil.defaultTitle
  const fps = Number.isFinite(draft.fps) ? Math.min(24, Math.max(6, Math.round(draft.fps))) : 12

  await enqueueSave(async (token) => {
    onProgress?.({ stage: 'preparing', done: 0, total })
    const blobs = await mapWithConcurrency(ordered, 3, async (frame) => {
      if (frame.blob) return frame.blob
      if (frame.existing?.galeriaId) return downloadFileAsBlob(token, frame.existing.galeriaId)
      throw new Error('Frame image missing')
    })

    const holds = ordered.map((frame) => clampHold(frame.hold))
    const repeats = Math.max(1, Math.min(3, Math.round(draft.exportSettings?.repeats ?? 1)))
    const videoFrames: Blob[] = []
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      for (let index = 0; index < blobs.length; index += 1) {
        for (let hold = 0; hold < holds[index]; hold += 1) videoFrames.push(blobs[index])
      }
    }

    onProgress?.({ stage: 'video', done: 0, total: videoFrames.length })
    const video = await exportSequenceVideo(
      videoFrames,
      fps,
      (done, count) => {
        onProgress?.({ stage: 'video', done, total: count })
      },
      {
        background: draft.exportSettings?.background,
        width: draft.exportSettings?.width,
        height: draft.exportSettings?.height,
      },
    )

    const folders = await ensureAnimationFolders(token, draft.id, title, draft.folderId)
    const videoName = `${safeFileName(title)}.${video.extension}`
    const uploadedVideo = await uploadBlob(token, video.blob, videoName, [folders.folderId], {
      kind: 'secuencia-video',
      id: draft.id,
    })
    const uploadedIds = [uploadedVideo.id]

    try {
      let done = 0
      const frames = await mapWithConcurrency(ordered, 2, async (frame, index) => {
        let galeriaId = frame.existing?.galeriaId
        let originalId = frame.existing?.originalId

        if (!galeriaId) {
          const blob = blobs[index]
          const gallery = await uploadBlob(
            token,
            blob,
            `${String(index + 1).padStart(2, '0')}.${imageExtension(blob)}`,
            [folders.framesFolderId],
            { kind: 'frame', frameId: frame.id, sequenceId: draft.id },
          )
          galeriaId = gallery.id
          uploadedIds.push(gallery.id)

          if (frame.original) {
            const original = await uploadBlob(
              token,
              frame.original,
              `${String(index + 1).padStart(2, '0')}-original.${fileExtension(frame.original)}`,
              [folders.originalsFolderId],
              { kind: 'original', frameId: frame.id, sequenceId: draft.id },
            )
            originalId = original.id
            uploadedIds.push(original.id)
          }
        } else {
          await addFilesToFolder(token, [galeriaId], folders.framesFolderId).catch(() => undefined)
          if (originalId) {
            await addFilesToFolder(token, [originalId], folders.originalsFolderId).catch(() => undefined)
          }
        }

        done += 1
        onProgress?.({ stage: 'frames', done, total })
        return {
          id: frame.id,
          orden: index,
          ...(frame.hold && frame.hold > 1 ? { hold: frame.hold } : {}),
          drive: { galeriaId, ...(originalId ? { originalId } : {}) },
        } satisfies Frame
      })

      onProgress?.({ stage: 'finishing', done: total, total })
      const coverIndex = draft.portadaFrameId
        ? Math.max(0, ordered.findIndex((frame) => frame.id === draft.portadaFrameId))
        : 0
      const miniatura = await blobToThumbnailDataUrl(blobs[coverIndex]).catch(() => draft.miniatura)
      const previous = useGalleryStore.getState().secuencias.find((sequence) => sequence.id === draft.id)
      const sequence: Secuencia = withUpdatedAt({
        schema: 1,
        id: draft.id,
        rev: (previous?.rev ?? 0) + 1,
        titulo: title,
        fps,
        bucle: draft.bucle,
        frames,
        mainFileId: uploadedVideo.id,
        folderId: folders.folderId,
        videoMime: video.mime,
        miniatura,
        coleccionIds: previous?.coleccionIds ?? draft.coleccionIds,
        portadaFrameId: draft.portadaFrameId,
        bucleRango: draft.bucleRango,
        exportSettings: draft.exportSettings,
      })

      await saveSecuencia(token, sequence)
      if (previous) useGalleryStore.getState().updateSecuencia(sequence.id, sequence)
      else useGalleryStore.getState().addSecuencia(sequence)
      await cleanupPrevious(token, previous, sequence)
      result = { sequence, frames }
    } catch (error) {
      await Promise.allSettled(uploadedIds.map((fileId) => trashFile(token, fileId)))
      if (!draft.folderId) await trashFile(token, folders.folderId).catch(() => undefined)
      throw error
    }
  })

  if (!result) throw new Error('Save failed')
  return result
}
