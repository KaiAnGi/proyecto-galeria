import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Obra, Coleccion, Entrega } from './store'

vi.mock('./upload', () => ({
  getFolderIds: vi.fn(async () => ({
    rootId: 'root',
    archivosId: 'arch',
    originalesId: 'orig',
    galeriaId: 'gal',
    miniaturasId: 'mini',
    datosId: 'datos',
    obrasId: 'obras',
    coleccionesId: 'colecciones',
    secuenciasId: 'secuencias',
    entregasId: 'entregas',
  })),
}))

vi.mock('../drive/driveImageClient', () => ({
  upsertJson: vi.fn(async () => ({ id: 'up-1', name: 'x.json' })),
  listJsonFiles: vi.fn(async () => []),
  downloadJson: vi.fn(async () => ({})),
  trashFile: vi.fn(async () => undefined),
  findFileByName: vi.fn(async () => null),
  DRIVE_API: 'https://www.googleapis.com/drive/v3',
}))

vi.mock('../drive/collectionFolders', () => ({
  ensureColeccionFolder: vi.fn(async () => 'col-folder-1'),
  syncObraIntoColeccionFolder: vi.fn(async () => undefined),
}))

import { upsertJson, listJsonFiles, downloadJson, trashFile, findFileByName } from '../drive/driveImageClient'
import {
  saveObra,
  saveColeccion,
  saveEntrega,
  loadAllData,
  trashObra,
  trashEntrega,
  ensureLoaded,
  resetLoadedOnce,
} from './persistence'
import { useGalleryStore } from './store'

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
  coleccionIds: [],
  miniatura: '',
  archivos: [
    {
      id: 'a1',
      tipo: 'imagen',
      rol: 'tradicional',
      orden: 0,
      mime: 'image/webp',
      drive: { originalId: 'orig-1', galeriaId: 'gal-1', miniaturaId: 'mini-1' },
    },
  ],
}

const coleccion: Coleccion = {
  schema: 1,
  id: 'col-1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  nombre: 'Verano',
  tipo: 'general',
  orden: 0,
}

const entrega: Entrega = {
  schema: 1,
  id: 'ent-1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Retrato a lápiz',
  asignatura: 'Dibujo',
  fechaLimite: '2026-02-01',
  estado: 'pendiente',
  obraIds: ['obra-1'],
}

beforeEach(() => {
  vi.clearAllMocks()
  resetLoadedOnce()
  useGalleryStore.getState().hydrate({ obras: [], colecciones: [], secuencias: [], entregas: [] })
})

describe('saveObra', () => {
  it('upserts obra-<id>.json inside the obras folder', async () => {
    await saveObra('token', obra)

    expect(upsertJson).toHaveBeenCalledTimes(1)
    const [token, data, name, parents, appProps] = (upsertJson as any).mock.calls[0]
    expect(token).toBe('token')
    expect(data).toEqual(obra)
    expect(name).toBe('obra-obra-1.json')
    expect(parents).toEqual(['obras'])
    expect(appProps).toMatchObject({ kind: 'obra', id: 'obra-1' })
  })
})

describe('saveColeccion', () => {
  it('upserts coleccion-<id>.json inside the colecciones folder', async () => {
    await saveColeccion('token', coleccion)

    const [, data, name, parents, appProps] = (upsertJson as any).mock.calls[0]
    expect(data).toMatchObject({ id: 'col-1', nombre: 'Verano', driveFolderId: 'col-folder-1' })
    expect(name).toBe('coleccion-col-1.json')
    expect(parents).toEqual(['colecciones'])
    expect(appProps).toMatchObject({ kind: 'coleccion', id: 'col-1' })
  })
})

describe('loadAllData', () => {
  it('lists each folder and downloads every JSON', async () => {
    ;(listJsonFiles as any).mockImplementation(async (_token: string, folder: string) => {
      if (folder === 'obras') return [{ id: 'f1', name: 'obra-obra-1.json' }]
      if (folder === 'colecciones') return [{ id: 'f2', name: 'coleccion-col-1.json' }]
      if (folder === 'entregas') return [{ id: 'f4', name: 'entrega-ent-1.json' }]
      return [{ id: 'f3', name: 'secuencia-s1.json' }]
    })
    ;(downloadJson as any).mockImplementation(async (_token: string, id: string) => {
      if (id === 'f1') return obra
      if (id === 'f2') return coleccion
      if (id === 'f4') return entrega
      return { schema: 1, id: 's1', rev: 1, updatedAt: '', titulo: 't', fps: 12, bucle: true, frames: [], miniatura: '' }
    })

    const data = await loadAllData('token')

    expect(data.obras).toEqual([obra])
    expect(data.colecciones).toEqual([coleccion])
    expect(data.secuencias).toHaveLength(1)
    expect(data.entregas).toEqual([entrega])
    expect(listJsonFiles).toHaveBeenCalledTimes(4)
  })
})

describe('saveEntrega', () => {
  it('upserts entrega-<id>.json inside the entregas folder', async () => {
    await saveEntrega('token', entrega)

    const [, data, name, parents, appProps] = (upsertJson as any).mock.calls[0]
    expect(data).toEqual(entrega)
    expect(name).toBe('entrega-ent-1.json')
    expect(parents).toEqual(['entregas'])
    expect(appProps).toMatchObject({ kind: 'entrega', id: 'ent-1' })
  })
})

describe('trashEntrega', () => {
  it('moves the entrega JSON to the trash', async () => {
    ;(findFileByName as any).mockResolvedValue({ id: 'json-9', name: 'entrega-ent-1.json' })

    await trashEntrega('token', entrega)

    expect(findFileByName).toHaveBeenCalledWith('token', 'entrega-ent-1.json', 'entregas')
    expect(trashFile).toHaveBeenCalledWith('token', 'json-9')
  })
})

describe('trashObra', () => {
  it('trashes every file of the obra and its JSON', async () => {
    ;(findFileByName as any).mockResolvedValue({ id: 'json-1', name: 'obra-obra-1.json' })

    await trashObra('token', obra)

    const trashedIds = (trashFile as any).mock.calls.map((c: any[]) => c[1])
    expect(trashedIds).toEqual(expect.arrayContaining(['orig-1', 'gal-1', 'mini-1', 'json-1']))
    expect(findFileByName).toHaveBeenCalledWith('token', 'obra-obra-1.json', 'obras')
  })
})

describe('ensureLoaded', () => {
  it('hydrates the store once and skips subsequent calls', async () => {
    ;(listJsonFiles as any).mockResolvedValue([])
    ;(downloadJson as any).mockResolvedValue({})

    await ensureLoaded('token')
    await ensureLoaded('token')

    expect(listJsonFiles).toHaveBeenCalledTimes(4)
  })
})
