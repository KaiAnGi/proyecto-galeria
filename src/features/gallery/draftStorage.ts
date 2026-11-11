import { openDB, type IDBPDatabase } from 'idb'
import type { Frame } from './secuencias'
import type { DraftFrame, SequenceDraft } from './sequenceDrafts'

const DB_NAME = 'kuromi-likes-your-drawings'
const DB_VERSION = 1
const STORE = 'animation-drafts'
const MAX_STORED_DRAFTS = 12

export interface StoredDraftFrame {
  id: string
  orden: number
  hold?: number
  existing?: Frame['drive']
  blob?: Blob
  original?: File
}

export interface StoredDraft {
  id: string
  titulo: string
  fps: number
  bucle: boolean
  frames: StoredDraftFrame[]
  folderId?: string
  mainFileId?: string
  videoMime?: string
  miniatura: string
  coleccionIds: string[]
  portadaFrameId?: string
  bucleRango?: [number, number]
  exportSettings?: SequenceDraft['exportSettings']
  dirty: boolean
}

export interface StoredDraftRecord {
  id: string
  updatedAt: string
  draft: StoredDraft
}

let dbPromise: Promise<IDBPDatabase | null> | null = null

function storageAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function'
}

async function getDb(): Promise<IDBPDatabase | null> {
  if (!storageAvailable()) return null
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' })
        }
      },
    }).catch(() => null)
  }
  return dbPromise
}

export function toStoredDraft(draft: SequenceDraft): StoredDraft {
  return {
    id: draft.id,
    titulo: draft.titulo,
    fps: draft.fps,
    bucle: draft.bucle,
    frames: draft.frames.map((frame) => {
      const stored: StoredDraftFrame = {
        id: frame.id,
        orden: frame.orden,
      }
      if (frame.hold && frame.hold > 1) stored.hold = frame.hold
      if (frame.existing) stored.existing = frame.existing
      if (frame.blob) stored.blob = frame.blob
      if (frame.original) stored.original = frame.original
      return stored
    }),
    folderId: draft.folderId,
    mainFileId: draft.mainFileId,
    videoMime: draft.videoMime,
    miniatura: draft.miniatura,
    coleccionIds: draft.coleccionIds,
    portadaFrameId: draft.portadaFrameId,
    bucleRango: draft.bucleRango,
    exportSettings: draft.exportSettings,
    dirty: draft.dirty,
  }
}

export function fromStoredDraft(stored: StoredDraft): SequenceDraft {
  const frames: DraftFrame[] = stored.frames.map((frame) => ({
    id: frame.id,
    orden: frame.orden,
    hold: frame.hold,
    existing: frame.existing,
    blob: frame.blob,
    original: frame.original,
    ...(frame.blob ? { previewUrl: URL.createObjectURL(frame.blob) } : {}),
  }))

  return {
    id: stored.id,
    titulo: stored.titulo,
    fps: stored.fps,
    bucle: stored.bucle,
    frames,
    folderId: stored.folderId,
    mainFileId: stored.mainFileId,
    videoMime: stored.videoMime,
    miniatura: stored.miniatura,
    coleccionIds: stored.coleccionIds,
    portadaFrameId: stored.portadaFrameId,
    bucleRango: stored.bucleRango,
    exportSettings: stored.exportSettings,
    dirty: stored.dirty,
  }
}

export async function saveDraftToStorage(draft: SequenceDraft): Promise<boolean> {
  const db = await getDb()
  if (!db) return false
  try {
    const record: StoredDraftRecord = {
      id: draft.id,
      updatedAt: new Date().toISOString(),
      draft: toStoredDraft(draft),
    }
    await db.put(STORE, record)
    await pruneDraftStorage()
    return true
  } catch {
    return false
  }
}

export async function loadDraftFromStorage(id: string): Promise<SequenceDraft | null> {
  const db = await getDb()
  if (!db) return null
  try {
    const record = (await db.get(STORE, id)) as StoredDraftRecord | undefined
    return record ? fromStoredDraft(record.draft) : null
  } catch {
    return null
  }
}

export async function deleteDraftFromStorage(id: string): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    await db.delete(STORE, id)
  } catch {
    // Storage is only a local safety copy; failing to remove it must not block editing.
  }
}

export async function pruneDraftStorage(max = MAX_STORED_DRAFTS): Promise<void> {
  const db = await getDb()
  if (!db) return
  try {
    const records = (await db.getAll(STORE)) as StoredDraftRecord[]
    if (records.length <= max) return
    const oldest = [...records].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).slice(0, records.length - max)
    await Promise.all(oldest.map((record) => db.delete(STORE, record.id)))
  } catch {
    // Best effort cleanup.
  }
}

export function resetDraftStorageForTests(): void {
  dbPromise = null
}
