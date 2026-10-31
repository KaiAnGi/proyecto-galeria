import { useSyncExternalStore } from 'react'
import { useGalleryStore } from './store'
import { enqueueSave } from './saveQueue'
import { trashColeccion, trashEntrega, trashFrameFiles, trashObra, trashSecuencia } from './persistence'
import { removeFrame, sortFrames } from './sequenceFrames'
import { persistLatestSequence } from './sequenceSave'
import { scheduleGifRefresh } from './gifRefreshScheduler'
import { refreshSequenceCover } from './sequenceCover'
import type { Coleccion, Entrega, Obra } from './store'
import type { Frame, Secuencia } from './secuencias'

interface TrashEntry {
  key: string
  restore: () => void
  commit: (token: string) => Promise<void>
}

interface PendingTrash {
  entry: TrashEntry
  timeout: ReturnType<typeof setTimeout>
}

export interface TrashSnapshot {
  count: number
}

const UNDO_MS = 7000
const listeners = new Set<() => void>()
const pending = new Map<string, PendingTrash>()
let installed = false
let snapshot: TrashSnapshot = { count: 0 }

function emit(): void {
  snapshot = { count: pending.size }
  for (const listener of listeners) listener()
}

export function subscribeTrash(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTrashSnapshot(): TrashSnapshot {
  return snapshot
}

export function useTrashQueue(): TrashSnapshot {
  return useSyncExternalStore(subscribeTrash, getTrashSnapshot, getTrashSnapshot)
}

function commit(key: string): void {
  const item = pending.get(key)
  if (!item) return
  pending.delete(key)
  clearTimeout(item.timeout)
  emit()
  void enqueueSave(item.entry.commit).catch(() => undefined)
}

export function queueTrash(entry: TrashEntry): void {
  const existing = pending.get(entry.key)
  if (existing) {
    clearTimeout(existing.timeout)
  }
  const timeout = setTimeout(() => commit(entry.key), UNDO_MS)
  pending.set(entry.key, { entry, timeout })
  emit()
}

export function undoTrash(key?: string): void {
  const keys = key ? [key] : [...pending.keys()]
  for (const entryKey of keys) {
    const item = pending.get(entryKey)
    if (!item) continue
    clearTimeout(item.timeout)
    pending.delete(entryKey)
    item.entry.restore()
  }
  emit()
}

export function flushTrash(): void {
  for (const key of [...pending.keys()]) commit(key)
}

export function installTrashFlush(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('pagehide', flushTrash)
  window.addEventListener('beforeunload', flushTrash)
}

export function queueObraTrash(obra: Obra): void {
  useGalleryStore.getState().removeObraSoft(obra.id)
  queueTrash({
    key: `obra:${obra.id}`,
    restore: () => useGalleryStore.getState().addObra(obra),
    commit: (token) => trashObra(token, obra),
  })
}

export function queueColeccionTrash(coleccion: Coleccion): void {
  const state = useGalleryStore.getState()
  const obras = state.obras.filter((o) => o.coleccionIds.includes(coleccion.id))
  const secuencias = state.secuencias.filter((s) => (s.coleccionIds ?? []).includes(coleccion.id))

  state.removeColeccion(coleccion.id)
  for (const obra of obras) state.removeObraFromColeccion(obra.id, coleccion.id)
  for (const secuencia of secuencias) state.removeSecuenciaFromColeccion(secuencia.id, coleccion.id)

  queueTrash({
    key: `coleccion:${coleccion.id}`,
    restore: () => {
      const store = useGalleryStore.getState()
      store.addColeccion(coleccion)
      for (const obra of obras) {
        store.updateObra(obra.id, { coleccionIds: obra.coleccionIds, ordenEnColeccion: obra.ordenEnColeccion })
      }
      for (const secuencia of secuencias) {
        store.updateSecuencia(secuencia.id, { coleccionIds: secuencia.coleccionIds })
      }
    },
    commit: (token) => trashColeccion(token, coleccion, { obras, secuencias }),
  })
}

export function queueSecuenciaTrash(secuencia: Secuencia): void {
  useGalleryStore.getState().removeSecuencia(secuencia.id)
  queueTrash({
    key: `secuencia:${secuencia.id}`,
    restore: () => useGalleryStore.getState().addSecuencia(secuencia),
    commit: (token) => trashSecuencia(token, secuencia),
  })
}

export function queueFrameTrash(secuencia: Secuencia, frame: Frame): void {
  const current = useGalleryStore.getState().secuencias.find((item) => item.id === secuencia.id)
  if (!current || current.frames.length <= 1) return

  const ordered = sortFrames(current.frames)
  const index = ordered.findIndex((item) => item.id === frame.id)
  if (index < 0) return

  const previousId = ordered[index - 1]?.id
  const nextId = ordered[index + 1]?.id
  const firstBefore = ordered[0]?.id
  const frames = removeFrame(current.frames, frame.id)
  const firstAfter = sortFrames(frames)[0]?.id
  useGalleryStore.getState().updateSecuencia(secuencia.id, { frames })
  persistLatestSequence(secuencia.id)
  scheduleGifRefresh(secuencia.id)
  if (firstBefore !== firstAfter) void refreshSequenceCover(secuencia.id)

  queueTrash({
    key: `frame:${secuencia.id}:${frame.id}`,
    restore: () => {
      const latest = useGalleryStore.getState().secuencias.find((item) => item.id === secuencia.id)
      if (!latest) return
      const restored = sortFrames(latest.frames)
      const previousIndex = previousId ? restored.findIndex((item) => item.id === previousId) : -1
      const nextIndex = nextId ? restored.findIndex((item) => item.id === nextId) : -1
      const insertAt =
        previousIndex >= 0
          ? previousIndex + 1
          : nextIndex >= 0
            ? nextIndex
            : Math.min(index, restored.length)
      restored.splice(insertAt, 0, frame)
      const nextFrames = restored.map((item, itemIndex) => ({ ...item, orden: itemIndex }))
      useGalleryStore.getState().updateSecuencia(secuencia.id, { frames: nextFrames })
      persistLatestSequence(secuencia.id)
      scheduleGifRefresh(secuencia.id)
      if (firstBefore !== nextFrames[0]?.id) void refreshSequenceCover(secuencia.id)
    },
    commit: (token) => trashFrameFiles(token, frame),
  })
}

export function queueEntregaTrash(entrega: Entrega): void {
  useGalleryStore.getState().removeEntrega(entrega.id)
  queueTrash({
    key: `entrega:${entrega.id}`,
    restore: () => useGalleryStore.getState().addEntrega(entrega),
    commit: (token) => trashEntrega(token, entrega),
  })
}
