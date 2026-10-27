import { useSyncExternalStore } from 'react'
import { ensureToken } from '../auth/googleAuth'
import { friendlyError } from '../../lib/errors/friendlyError'
import { es } from '../../i18n/es'

export interface SaveStatusSnapshot {
  pending: number
  error: string | null
}

type SaveOperation = (token: string) => Promise<void>

const listeners = new Set<() => void>()
let pending = 0
let error: string | null = null
let tail: Promise<void> = Promise.resolve()
let lastFailed: SaveOperation | null = null

let snapshot: SaveStatusSnapshot = { pending, error }

function emit(): void {
  snapshot = { pending, error }
  for (const listener of listeners) listener()
}

export function subscribeSaveStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSaveStatusSnapshot(): SaveStatusSnapshot {
  return snapshot
}

export function useSaveStatus(): SaveStatusSnapshot {
  return useSyncExternalStore(subscribeSaveStatus, getSaveStatusSnapshot, getSaveStatusSnapshot)
}

export function enqueueSave(operation: SaveOperation): Promise<void> {
  pending += 1
  emit()

  const job = tail.then(async () => {
    const token = await ensureToken()
    await operation(token)
  })

  tail = job.catch(() => undefined)

  return job
    .then(() => {
      error = null
      lastFailed = null
    })
    .catch((e) => {
      error = friendlyError(e, es.app.saveError)
      lastFailed = operation
      throw e
    })
    .finally(() => {
      pending -= 1
      emit()
    })
}

export function retryLastSave(): void {
  const operation = lastFailed
  if (!operation) return
  lastFailed = null
  void enqueueSave(operation).catch(() => undefined)
}

export function clearSaveError(): void {
  error = null
  lastFailed = null
  emit()
}
