import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Secuencia } from './secuencias'
import {
  appendFramesToDraft,
  createDraftFromSequence,
  insertDraftFrame,
  moveDraftFrame,
  normalizeDraftFrames,
  removeDraftFrame,
  sortDraftFrames,
  useSequenceDrafts,
  type DraftFrame,
  type SequenceDraft,
} from './sequenceDrafts'

const sequence: Secuencia = {
  schema: 1,
  id: 'sec-1',
  rev: 1,
  updatedAt: '2026-01-02T00:00:00.000Z',
  titulo: 'Olas',
  fps: 12,
  bucle: true,
  frames: [
    { id: 'b', orden: 4, drive: { galeriaId: 'gal-b', originalId: 'orig-b' } },
    { id: 'a', orden: 1, drive: { galeriaId: 'gal-a' } },
  ],
  mainFileId: 'video-1',
  folderId: 'folder-1',
  videoMime: 'video/mp4',
  miniatura: 'thumb',
  coleccionIds: ['col-1'],
}

function draft(frames: DraftFrame[]): SequenceDraft {
  return {
    id: 'draft-1',
    titulo: 'Olas',
    fps: 12,
    bucle: true,
    frames,
    miniatura: '',
    coleccionIds: [],
    dirty: false,
  }
}

function frame(id: string, orden: number): DraftFrame {
  return { id, orden, existing: { galeriaId: `gal-${id}` } }
}

beforeEach(() => {
  useSequenceDrafts.setState({ drafts: {}, histories: {} })
})

describe('sequenceDrafts', () => {
  it('creates a clean draft from a saved sequence in frame order', () => {
    const result = createDraftFromSequence(sequence)

    expect(result).toMatchObject({
      id: 'sec-1',
      titulo: 'Olas',
      folderId: 'folder-1',
      mainFileId: 'video-1',
      videoMime: 'video/mp4',
      dirty: false,
    })
    expect(result.frames.map((item) => item.id)).toEqual(['a', 'b'])
    expect(result.frames.map((item) => item.orden)).toEqual([0, 1])
    expect(result.frames[1].existing).toEqual({ galeriaId: 'gal-b', originalId: 'orig-b' })
  })

  it('normalizes, moves and removes frames without mutating the draft', () => {
    const source = draft([frame('a', 4), frame('b', 9), frame('c', 12)])
    const normalized = normalizeDraftFrames(source.frames)
    const moved = moveDraftFrame(source, 2, 0)
    const removed = removeDraftFrame(source, 'b')

    expect(normalized.map((item) => item.orden)).toEqual([0, 1, 2])
    expect(sortDraftFrames(moved.frames).map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(removed.frames.map((item) => item.id)).toEqual(['a', 'c'])
    expect(source.frames.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  it('appends and inserts frames with a compact order', () => {
    const source = draft([frame('a', 0), frame('b', 1)])
    const appended = appendFramesToDraft(source, [frame('c', 20), frame('d', 21)])
    const restored = insertDraftFrame(draft([frame('a', 0), frame('c', 1)]), frame('b', 9), 1)

    expect(appended.frames.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(appended.frames.map((item) => item.orden)).toEqual([0, 1, 2, 3])
    expect(restored.frames.map((item) => item.id)).toEqual(['a', 'b', 'c'])
    expect(restored.frames.map((item) => item.orden)).toEqual([0, 1, 2])
  })

  it('copies holds and optional sequence settings into the draft', () => {
    const result = createDraftFromSequence({
      ...sequence,
      frames: [
        { id: 'a', orden: 0, hold: 3, drive: { galeriaId: 'gal-a' } },
        { id: 'b', orden: 1, drive: { galeriaId: 'gal-b' } },
      ],
      portadaFrameId: 'a',
      bucleRango: [0, 1],
      exportSettings: { width: 1080, repeats: 2, background: 'white' },
    })

    expect(result.frames[0].hold).toBe(3)
    expect(result.frames[1].hold).toBeUndefined()
    expect(result.portadaFrameId).toBe('a')
    expect(result.bucleRango).toEqual([0, 1])
    expect(result.exportSettings).toEqual({ width: 1080, repeats: 2, background: 'white' })
  })

  it('undoes and redoes committed changes', () => {
    useSequenceDrafts.getState().putDraft(draft([frame('a', 0), frame('b', 1)]))
    const store = useSequenceDrafts.getState()

    store.commitDraft('draft-1', (current) => removeDraftFrame(current, 'a'))
    expect(useSequenceDrafts.getState().drafts['draft-1'].frames.map((item) => item.id)).toEqual(['b'])
    expect(useSequenceDrafts.getState().histories['draft-1'].past).toHaveLength(1)

    useSequenceDrafts.getState().undoDraft('draft-1')
    expect(useSequenceDrafts.getState().drafts['draft-1'].frames.map((item) => item.id)).toEqual(['a', 'b'])
    expect(useSequenceDrafts.getState().histories['draft-1'].future).toHaveLength(1)

    useSequenceDrafts.getState().redoDraft('draft-1')
    expect(useSequenceDrafts.getState().drafts['draft-1'].frames.map((item) => item.id)).toEqual(['b'])
  })

  it('does not add ordinary edits to the undo history', () => {
    useSequenceDrafts.getState().putDraft(draft([frame('a', 0)]))
    const store = useSequenceDrafts.getState()

    store.updateDraft('draft-1', (current) => ({ ...current, titulo: 'Nuevo' }))

    expect(useSequenceDrafts.getState().histories['draft-1']).toBeUndefined()
  })

  it('marks edits as unsaved and revokes local previews when discarded', () => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', { ...URL, revokeObjectURL: revoke })
    const previewUrl = 'blob:preview'
    useSequenceDrafts.getState().putDraft(draft([{ id: 'new', orden: 0, previewUrl }]))

    useSequenceDrafts.getState().updateDraft('draft-1', (current) => ({
      ...current,
      titulo: 'Nuevo',
    }))

    expect(useSequenceDrafts.getState().drafts['draft-1']).toMatchObject({ titulo: 'Nuevo', dirty: true })

    useSequenceDrafts.getState().removeDraft('draft-1')

    expect(revoke).toHaveBeenCalledWith(previewUrl)
    expect(useSequenceDrafts.getState().drafts['draft-1']).toBeUndefined()
    vi.unstubAllGlobals()
  })
})
