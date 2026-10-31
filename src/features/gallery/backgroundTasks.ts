import { useSyncExternalStore } from 'react'
import type { GifRefreshStage } from './gifRefresh'

export type BackgroundTaskKind = 'originals' | 'gif'

export interface BackgroundTask {
  key: string
  kind: BackgroundTaskKind
  sequenceId: string
  sequenceTitle: string
  done: number
  total: number
  stage?: GifRefreshStage
  status: 'running' | 'error'
}

const listeners = new Set<() => void>()
const tasks = new Map<string, BackgroundTask>()
let snapshot: BackgroundTask[] = []

function emit(): void {
  snapshot = [...tasks.values()]
  for (const listener of listeners) listener()
}

export function subscribeBackgroundTasks(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBackgroundTasksSnapshot(): BackgroundTask[] {
  return snapshot
}

export function useBackgroundTasks(): BackgroundTask[] {
  return useSyncExternalStore(subscribeBackgroundTasks, getBackgroundTasksSnapshot, getBackgroundTasksSnapshot)
}

export function updateBackgroundTask(key: string, patch: Partial<Omit<BackgroundTask, 'key'>>): void {
  const current = tasks.get(key)
  if (!current) return
  tasks.set(key, { ...current, ...patch })
  emit()
}

export function startBackgroundTask(task: Omit<BackgroundTask, 'done' | 'total' | 'status'> & { total?: number }): void {
  tasks.set(task.key, { ...task, done: 0, total: task.total ?? 0, status: 'running' })
  emit()
}

export function finishBackgroundTask(key: string): void {
  if (!tasks.delete(key)) return
  emit()
}

export function failBackgroundTask(key: string): void {
  const current = tasks.get(key)
  if (!current) return
  tasks.set(key, { ...current, status: 'error' })
  emit()
}
