import { beforeEach, describe, expect, it } from 'vitest'
import type { Secuencia } from './secuencias'
import { useGalleryStore } from './store'

function secuencia(overrides: Partial<Secuencia> = {}): Secuencia {
  return {
    schema: 1,
    id: 's1',
    rev: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    titulo: 'Animación',
    fps: 12,
    bucle: true,
    frames: [],
    miniatura: '',
    coleccionIds: [],
    ...overrides,
  }
}

function reset(secuencias: Secuencia[]): void {
  useGalleryStore.getState().hydrate({ obras: [], colecciones: [], secuencias, entregas: [] })
}

beforeEach(() => {
  reset([])
})

describe('addSecuenciaToColeccion', () => {
  it('adds the collection without duplicating it', () => {
    reset([secuencia()])

    useGalleryStore.getState().addSecuenciaToColeccion('s1', 'col-1')
    useGalleryStore.getState().addSecuenciaToColeccion('s1', 'col-1')

    expect(useGalleryStore.getState().secuencias[0].coleccionIds).toEqual(['col-1'])
  })

  it('works with sequences saved before collections existed', () => {
    reset([secuencia({ coleccionIds: undefined })])

    useGalleryStore.getState().addSecuenciaToColeccion('s1', 'col-1')

    expect(useGalleryStore.getState().secuencias[0].coleccionIds).toEqual(['col-1'])
  })
})

describe('removeSecuenciaFromColeccion', () => {
  it('removes only the requested collection', () => {
    reset([secuencia({ coleccionIds: ['col-1', 'col-2'] })])

    useGalleryStore.getState().removeSecuenciaFromColeccion('s1', 'col-1')

    expect(useGalleryStore.getState().secuencias[0].coleccionIds).toEqual(['col-2'])
  })

  it('leaves other sequences untouched', () => {
    reset([secuencia(), secuencia({ id: 's2', coleccionIds: ['col-1'] })])

    useGalleryStore.getState().removeSecuenciaFromColeccion('s1', 'col-1')

    expect(useGalleryStore.getState().secuencias[1].coleccionIds).toEqual(['col-1'])
  })
})
