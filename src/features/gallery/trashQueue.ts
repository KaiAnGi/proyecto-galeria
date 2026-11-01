import { useSyncExternalStore } from 'react'
import { useGalleryStore } from './store'
import { enqueueSave } from './saveQueue'
import { trashColeccion, trashEntrega, trashObra, trashSecuencia } from './persistence'
import type { Coleccion, Entrega, Obra } from './store'
import type { Secuencia } from './secuencias'

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

export function queueEntregaTrash(entrega: Entrega): void {
  useGalleryStore.getState().removeEntrega(entrega.id)
  queueTrash({
    key: `entrega:${entrega.id}`,
    restore: () => useGalleryStore.getState().addEntrega(entrega),
    commit: (token) => trashEntrega(token, entrega),
  })
}
