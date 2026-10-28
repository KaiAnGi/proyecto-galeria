import { describe, expect, it } from 'vitest'
import { secuenciaFileIds } from './collectionFolders'
import type { Secuencia } from '../gallery/secuencias'

describe('secuenciaFileIds', () => {
  it('collects the original and gallery file of every frame', () => {
    const secuencia: Secuencia = {
      schema: 1,
      id: 's1',
      rev: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      titulo: 'Animación',
      fps: 12,
      bucle: true,
      frames: [
        { id: 'f1', orden: 0, drive: { originalId: 'orig-1', galeriaId: 'gal-1' } },
        { id: 'f2', orden: 1, drive: { originalId: 'orig-2', galeriaId: 'gal-2' } },
      ],
      miniatura: '',
    }

    expect(secuenciaFileIds(secuencia)).toEqual(['orig-1', 'gal-1', 'orig-2', 'gal-2'])
  })
})
