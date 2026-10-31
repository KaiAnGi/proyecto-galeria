import { failBackgroundTask, finishBackgroundTask, startBackgroundTask, updateBackgroundTask } from './backgroundTasks'
import { persistLatestSequence } from './sequenceSave'
import { useGalleryStore } from './store'
import type { UploadOriginalsResult, UploadedFrame } from './pencilUpload'

interface OriginalUploadJob {
  frames: UploadedFrame[]
  uploadOriginals: (options?: {
    onProgress?: (done: number, total: number) => void
    onFrameUploaded?: (frameId: string, originalId: string) => void
    shouldContinue?: () => boolean
  }) => Promise<UploadOriginalsResult>
}

export function startOriginalUploads(sequenceId: string, sequenceTitle: string, job: OriginalUploadJob): void {
  const key = `originals:${sequenceId}`
  const total = job.frames.length
  startBackgroundTask({
    key,
    kind: 'originals',
    sequenceId,
    sequenceTitle,
    total,
  })

  void job
    .uploadOriginals({
      shouldContinue: () => useGalleryStore.getState().secuencias.some((sequence) => sequence.id === sequenceId),
      onFrameUploaded: (frameId, originalId) => {
        const latest = useGalleryStore.getState().secuencias.find((sequence) => sequence.id === sequenceId)
        if (!latest) return
        useGalleryStore.getState().updateSecuencia(sequenceId, {
          frames: latest.frames.map((frame) =>
            frame.id === frameId ? { ...frame, drive: { ...frame.drive, originalId } } : frame,
          ),
        })
      },
      onProgress: (done, total) => {
        updateBackgroundTask(key, { done, total })
        if (done === total || done % 6 === 0) persistLatestSequence(sequenceId)
      },
    })
    .then(({ failed }) => {
      if (failed > 0) failBackgroundTask(key)
      else finishBackgroundTask(key)
    })
    .catch(() => failBackgroundTask(key))
}
