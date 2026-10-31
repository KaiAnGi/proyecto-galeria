import { failBackgroundTask, finishBackgroundTask, startBackgroundTask, updateBackgroundTask } from './backgroundTasks'
import { gifSignature } from './sequenceFrames'
import { persistLatestSequence } from './sequenceSave'
import { useGalleryStore } from './store'

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const state = new Map<string, { running: boolean; pending: boolean }>()

function taskKey(sequenceId: string): string {
  return `gif:${sequenceId}`
}

async function runGifRefresh(sequenceId: string): Promise<void> {
  const current = state.get(sequenceId) ?? { running: false, pending: false }
  if (current.running) {
    current.pending = true
    state.set(sequenceId, current)
    return
  }

  const sequence = useGalleryStore.getState().secuencias.find((item) => item.id === sequenceId)
  if (!sequence) {
    finishBackgroundTask(taskKey(sequenceId))
    return
  }

  const key = taskKey(sequenceId)
  current.running = true
  state.set(sequenceId, current)
  startBackgroundTask({
    key,
    kind: 'gif',
    sequenceId,
    sequenceTitle: sequence.titulo,
    total: sequence.frames.length,
    stage: 'loading',
  })

  try {
    const { refreshSequenceGif } = await import('./gifRefresh')
    const result = await refreshSequenceGif(sequence, {
      onProgress: (done, total) => updateBackgroundTask(key, { done, total }),
      onStage: (stage) => updateBackgroundTask(key, { stage }),
    })

    const latest = useGalleryStore.getState().secuencias.find((item) => item.id === sequenceId)
    if (latest) {
      const matches = gifSignature(latest) === result.signature
      useGalleryStore.getState().updateSecuencia(sequenceId, {
        mainFileId: result.mainFileId,
        ...(matches ? { gifSignature: result.signature } : {}),
      })
      persistLatestSequence(sequenceId)
      if (!matches) scheduleGifRefresh(sequenceId)
    }
    finishBackgroundTask(key)
  } catch {
    failBackgroundTask(key)
  } finally {
    current.running = false
    if (current.pending) {
      current.pending = false
      state.set(sequenceId, current)
      scheduleGifRefresh(sequenceId, 0)
    } else {
      state.set(sequenceId, current)
    }
  }
}

export function scheduleGifRefresh(sequenceId: string, delay = 800): void {
  const existing = timers.get(sequenceId)
  if (existing) clearTimeout(existing)
  const timeout = setTimeout(() => {
    timers.delete(sequenceId)
    void runGifRefresh(sequenceId)
  }, delay)
  timers.set(sequenceId, timeout)
}
