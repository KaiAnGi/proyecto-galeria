import { describe, expect, it } from 'vitest'
import { fromStoredDraft, saveDraftToStorage, toStoredDraft } from './draftStorage'
import type { SequenceDraft } from './sequenceDrafts'

const draft: SequenceDraft = {
  id: 'draft-1',
  titulo: 'Prueba',
  fps: 12,
  bucle: false,
  frames: [
    { id: 'a', orden: 0, hold: 2, existing: { galeriaId: 'gal-a' } },
    { id: 'b', orden: 1, blob: new Blob(['x'], { type: 'image/webp' }) },
  ],
  miniatura: '',
  coleccionIds: ['col-1'],
  portadaFrameId: 'a',
  bucleRango: [0, 1],
  exportSettings: { width: 720, background: 'black' },
  dirty: true,
}

describe('draftStorage', () => {
  it('round-trips a draft without local object URLs', () => {
    const stored = toStoredDraft(draft)

    expect(stored.frames[0]).toMatchObject({ id: 'a', orden: 0, hold: 2 })
    expect(stored.frames[0].existing).toEqual({ galeriaId: 'gal-a' })
    expect(stored.portadaFrameId).toBe('a')
    expect(stored.bucleRango).toEqual([0, 1])
    expect(stored.exportSettings).toEqual({ width: 720, background: 'black' })

    const restored = fromStoredDraft(stored)
    expect(restored).toMatchObject({
      id: 'draft-1',
      titulo: 'Prueba',
      bucle: false,
      dirty: true,
      portadaFrameId: 'a',
    })
    expect(restored.frames.map((frame) => frame.id)).toEqual(['a', 'b'])
    expect(restored.frames[1].blob).toBeInstanceOf(Blob)
    expect(restored.frames[1].previewUrl).toMatch(/^blob:/)
  })

  it('does nothing when IndexedDB is not available', async () => {
    await expect(saveDraftToStorage(draft)).resolves.toBe(false)
  })
})
