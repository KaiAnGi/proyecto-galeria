import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./saveQueue', () => ({
  enqueueSave: vi.fn(),
}))

vi.mock('./persistence', () => ({
  trashObra: vi.fn(async () => undefined),
  trashColeccion: vi.fn(async () => undefined),
  trashSecuencia: vi.fn(async () => undefined),
  trashEntrega: vi.fn(async () => undefined),
}))

import { enqueueSave } from './saveQueue'
import { trashColeccion } from './persistence'
import { useGalleryStore } from './store'
import type { Coleccion, Obra } from './store'
import type { Secuencia } from './secuencias'
import { flushTrash, getTrashSnapshot, queueColeccionTrash, queueTrash, undoTrash } from './trashQueue'

const coleccion: Coleccion = {
  schema: 1,
  id: 'col-1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  nombre: 'Verano',
  tipo: 'general',
  orden: 0,
}

const obra: Obra = {
  schema: 1,
  id: 'obra-1',
  rev: 1,
  creadaEn: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Sin título',
  fecha: '2026-01-01',
  estado: 'terminada',
  origen: 'tradicional',
  tecnicas: [],
  tags: [],
  coleccionIds: ['col-1', 'col-2'],
  miniatura: '',
  archivos: [
    {
      id: 'a1',
      tipo: 'imagen',
      rol: 'tradicional',
      orden: 0,
      mime: 'image/webp',
      drive: { originalId: 'orig-1', galeriaId: 'gal-1' },
    },
  ],
}

const secuencia: Secuencia = {
  schema: 1,
  id: 's1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Animación',
  fps: 12,
  bucle: true,
  frames: [],
  miniatura: '',
  coleccionIds: ['col-1'],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(enqueueSave).mockImplementation(async (operation) => {
    await operation('token')
  })
  undoTrash()
  useGalleryStore.getState().hydrate({ obras: [], colecciones: [], secuencias: [], entregas: [] })
})

describe('trashQueue', () => {
  it('restores the item when the user undoes', () => {
    const restore = vi.fn()

    queueTrash({ key: 'obra:1', restore, commit: vi.fn(async () => undefined) })
    expect(getTrashSnapshot().count).toBe(1)

    undoTrash()

    expect(restore).toHaveBeenCalledTimes(1)
    expect(getTrashSnapshot().count).toBe(0)
  })

  it('moves pending items to the trash when flushed', async () => {
    const commit = vi.fn(async () => undefined)

    queueTrash({ key: 'obra:1', restore: vi.fn(), commit })
    flushTrash()

    await vi.waitFor(() => expect(commit).toHaveBeenCalledWith('token'))
    expect(getTrashSnapshot().count).toBe(0)
  })

  it('removes the collection and its links at once, and restores them on undo', () => {
    useGalleryStore.getState().hydrate({ obras: [obra], colecciones: [coleccion], secuencias: [secuencia] })

    queueColeccionTrash(coleccion)

    let state = useGalleryStore.getState()
    expect(state.colecciones).toHaveLength(0)
    expect(state.obras[0].coleccionIds).toEqual(['col-2'])
    expect(state.secuencias[0].coleccionIds).toEqual([])

    undoTrash()

    state = useGalleryStore.getState()
    expect(state.colecciones.map((c) => c.id)).toEqual(['col-1'])
    expect(state.obras[0].coleccionIds).toEqual(['col-1', 'col-2'])
    expect(state.secuencias[0].coleccionIds).toEqual(['col-1'])
  })

  it('trashes the collection with the works and animations it linked', async () => {
    useGalleryStore.getState().hydrate({ obras: [obra], colecciones: [coleccion], secuencias: [secuencia] })

    queueColeccionTrash(coleccion)
    flushTrash()

    await vi.waitFor(() =>
      expect(trashColeccion).toHaveBeenCalledWith('token', coleccion, {
        obras: [obra],
        secuencias: [secuencia],
      }),
    )
  })
})
