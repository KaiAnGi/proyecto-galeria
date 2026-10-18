import { describe, it, expect, beforeEach } from 'vitest'
import { useGalleryStore, type Obra } from './store'

function makeObra(id: string): Obra {
  const now = new Date().toISOString()
  return {
    schema: 1,
    id,
    rev: 1,
    creadaEn: now,
    updatedAt: now,
    titulo: 'Obra ' + id,
    fecha: now.slice(0, 10),
    estado: 'terminada',
    origen: 'tradicional',
    tecnicas: [],
    tags: [],
    coleccionIds: [],
    miniatura: 'data:image/webp;base64,abc',
    archivos: [],
  }
}

describe('gallery store', () => {
  beforeEach(() => {
    useGalleryStore.setState({ obras: [], trashedById: {} })
  })

  it('adds and finds obra', () => {
    useGalleryStore.getState().addObra(makeObra('a1'))
    expect(useGalleryStore.getState().obras).toHaveLength(1)
    expect(useGalleryStore.getState().obras[0].id).toBe('a1')
  })

  it('soft deletes an obra into trash', () => {
    useGalleryStore.getState().addObra(makeObra('a1'))
    useGalleryStore.getState().removeObraSoft('a1')
    expect(useGalleryStore.getState().obras).toHaveLength(0)
    expect(useGalleryStore.getState().trashedById['a1']?.id).toBe('a1')
  })

  it('undo restores the obra', () => {
    useGalleryStore.getState().addObra(makeObra('a1'))
    useGalleryStore.getState().removeObraSoft('a1')
    const trashed = useGalleryStore.getState().trashedById['a1']
    if (trashed) useGalleryStore.getState().addObra(trashed)
    useGalleryStore.getState().clearTrashUndo('a1')
    expect(useGalleryStore.getState().obras).toHaveLength(1)
    expect(useGalleryStore.getState().trashedById['a1']).toBeUndefined()
  })

  it('updateObra patches titulo and bumps updatedAt', () => {
    useGalleryStore.getState().addObra(makeObra('a1'))
    const before = useGalleryStore.getState().obras[0].updatedAt
    useGalleryStore.getState().updateObra('a1', { titulo: 'Nuevo' })
    const after = useGalleryStore.getState().obras[0]
    expect(after.titulo).toBe('Nuevo')
    expect(after.updatedAt >= before).toBe(true)
  })
})
