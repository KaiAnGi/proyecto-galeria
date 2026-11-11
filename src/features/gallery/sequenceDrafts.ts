import { create } from 'zustand'
import { ulid } from 'ulidx'
import { fileToBitmap, processImage } from '../../lib/image/imageProcessor'
import { mapWithConcurrency } from '../../lib/async/mapWithConcurrency'
import type { Frame, Secuencia } from './secuencias'
import { sortFrames } from './sequenceFrames'

const FRAME_MAX_SIDE = 1024
const FRAME_QUALITY = 0.72
const FRAME_CONCURRENCY = 3

export interface DraftFrame {
  id: string
  orden: number
  hold?: number
  existing?: Frame['drive']
  blob?: Blob
  original?: File
  previewUrl?: string
}

export interface SequenceDraft {
  id: string
  titulo: string
  fps: number
  bucle: boolean
  frames: DraftFrame[]
  folderId?: string
  mainFileId?: string
  videoMime?: string
  miniatura: string
  coleccionIds: string[]
  portadaFrameId?: string
  bucleRango?: [number, number]
  exportSettings?: {
    width?: number
    height?: number
    repeats?: number
    background?: 'black' | 'white'
  }
  dirty: boolean
}

export interface DraftHistory {
  past: SequenceDraft[]
  future: SequenceDraft[]
}

const HISTORY_LIMIT = 50

interface DraftState {
  drafts: Record<string, SequenceDraft>
  histories: Record<string, DraftHistory>
  putDraft: (draft: SequenceDraft) => void
  updateDraft: (id: string, updater: (draft: SequenceDraft) => SequenceDraft) => void
  commitDraft: (id: string, updater: (draft: SequenceDraft) => SequenceDraft) => void
  undoDraft: (id: string) => void
  redoDraft: (id: string) => void
  clearHistory: (id: string) => void
  removeDraft: (id: string) => void
}

export const useSequenceDrafts = create<DraftState>((set) => ({
  drafts: {},
  histories: {},
  putDraft: (draft) => set((state) => ({ drafts: { ...state.drafts, [draft.id]: draft } })),
  updateDraft: (id, updater) =>
    set((state) => {
      const current = state.drafts[id]
      if (!current) return state
      const next = updater(current)
      if (next === current) return state
      return { drafts: { ...state.drafts, [id]: { ...next, dirty: true } } }
    }),
  commitDraft: (id, updater) =>
    set((state) => {
      const current = state.drafts[id]
      if (!current) return state
      const next = updater(current)
      if (next === current) return state
      const history = state.histories[id] ?? { past: [], future: [] }
      return {
        drafts: { ...state.drafts, [id]: { ...next, dirty: true } },
        histories: {
          ...state.histories,
          [id]: {
            past: [...history.past, current].slice(-HISTORY_LIMIT),
            future: [],
          },
        },
      }
    }),
  undoDraft: (id) =>
    set((state) => {
      const current = state.drafts[id]
      const history = state.histories[id]
      if (!current || !history || history.past.length === 0) return state
      const previous = history.past[history.past.length - 1]
      return {
        drafts: { ...state.drafts, [id]: { ...previous, dirty: true } },
        histories: {
          ...state.histories,
          [id]: {
            past: history.past.slice(0, -1),
            future: [current, ...history.future].slice(0, HISTORY_LIMIT),
          },
        },
      }
    }),
  redoDraft: (id) =>
    set((state) => {
      const current = state.drafts[id]
      const history = state.histories[id]
      if (!current || !history || history.future.length === 0) return state
      const [next, ...future] = history.future
      return {
        drafts: { ...state.drafts, [id]: { ...next, dirty: true } },
        histories: {
          ...state.histories,
          [id]: {
            past: [...history.past, current].slice(-HISTORY_LIMIT),
            future,
          },
        },
      }
    }),
  clearHistory: (id) =>
    set((state) => {
      if (!state.histories[id]) return state
      const histories = { ...state.histories }
      delete histories[id]
      return { histories }
    }),
  removeDraft: (id) =>
    set((state) => {
      const current = state.drafts[id]
      if (current) revokeDraftUrls(current)
      const drafts = { ...state.drafts }
      delete drafts[id]
      const histories = { ...state.histories }
      delete histories[id]
      return { drafts, histories }
    }),
}))

export function sortDraftFrames(frames: DraftFrame[]): DraftFrame[] {
  return [...frames].sort((a, b) => a.orden - b.orden)
}

export function normalizeDraftFrames(frames: DraftFrame[]): DraftFrame[] {
  return frames.map((frame, index) => (frame.orden === index ? frame : { ...frame, orden: index }))
}

export function createDraftFromSequence(sequence: Secuencia): SequenceDraft {
  return {
    id: sequence.id,
    titulo: sequence.titulo,
    fps: sequence.fps,
    bucle: sequence.bucle,
    frames: sortFrames(sequence.frames).map((frame, index) => ({
      id: frame.id,
      orden: index,
      ...(frame.hold && frame.hold > 1 ? { hold: frame.hold } : {}),
      existing: frame.drive,
    })),
    folderId: sequence.folderId,
    mainFileId: sequence.mainFileId,
    videoMime: sequence.videoMime,
    miniatura: sequence.miniatura,
    coleccionIds: sequence.coleccionIds ?? [],
    portadaFrameId: sequence.portadaFrameId,
    bucleRango: sequence.bucleRango,
    exportSettings: sequence.exportSettings,
    dirty: false,
  }
}

export interface PreparedFramesResult {
  frames: DraftFrame[]
  firstPreviewUrl?: string
}

export async function prepareDraftFrames(
  files: File[],
  startOrder: number,
  onProgress?: (done: number, total: number) => void,
): Promise<PreparedFramesResult> {
  if (files.length === 0) return { frames: [] }
  onProgress?.(0, files.length)

  let done = 0
  const frames = await mapWithConcurrency(files, FRAME_CONCURRENCY, async (file, index) => {
    const bitmap = await fileToBitmap(file)
    try {
      const image = await processImage(bitmap, FRAME_MAX_SIDE, FRAME_QUALITY, false)
      const previewUrl = URL.createObjectURL(image.galleryBlob)
      const frame: DraftFrame = {
        id: ulid(),
        orden: startOrder + index,
        blob: image.galleryBlob,
        original: file,
        previewUrl,
      }
      done += 1
      onProgress?.(done, files.length)
      return frame
    } finally {
      bitmap.close()
    }
  })

  return { frames, firstPreviewUrl: frames[0]?.previewUrl }
}

export async function createDraftFromFiles(
  files: File[],
  options: { titulo: string; fps: number },
  onProgress?: (done: number, total: number) => void,
): Promise<SequenceDraft> {
  const { frames } = await prepareDraftFrames(files, 0, onProgress)
  return {
    id: ulid(),
    titulo: options.titulo,
    fps: options.fps,
    bucle: true,
    frames: normalizeDraftFrames(frames),
    miniatura: '',
    coleccionIds: [],
    dirty: true,
  }
}

export function appendFramesToDraft(draft: SequenceDraft, frames: DraftFrame[]): SequenceDraft {
  return { ...draft, frames: normalizeDraftFrames(sortDraftFrames([...draft.frames, ...frames])), dirty: true }
}

export function moveDraftFrame(draft: SequenceDraft, from: number, to: number): SequenceDraft {
  const sorted = sortDraftFrames(draft.frames)
  if (to < 0 || to >= sorted.length || from < 0 || from >= sorted.length || from === to) {
    return { ...draft, frames: normalizeDraftFrames(sorted) }
  }
  const [frame] = sorted.splice(from, 1)
  sorted.splice(to, 0, frame)
  return { ...draft, frames: normalizeDraftFrames(sorted) }
}

export function removeDraftFrame(draft: SequenceDraft, frameId: string): SequenceDraft {
  return {
    ...draft,
    frames: normalizeDraftFrames(sortDraftFrames(draft.frames).filter((frame) => frame.id !== frameId)),
    dirty: true,
  }
}

export function insertDraftFrame(draft: SequenceDraft, frame: DraftFrame, index: number): SequenceDraft {
  const sorted = sortDraftFrames(draft.frames)
  sorted.splice(Math.max(0, Math.min(index, sorted.length)), 0, frame)
  return { ...draft, frames: normalizeDraftFrames(sorted), dirty: true }
}

export function discardDraft(id: string): void {
  useSequenceDrafts.getState().removeDraft(id)
}

function revokeDraftUrls(draft: SequenceDraft): void {
  for (const frame of draft.frames) {
    if (frame.previewUrl) URL.revokeObjectURL(frame.previewUrl)
  }
}
