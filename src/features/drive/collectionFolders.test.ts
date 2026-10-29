import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Coleccion } from '../gallery/store'
import type { Secuencia } from '../gallery/secuencias'

vi.mock('./driveImageClient', () => ({
  DRIVE_API: 'https://www.googleapis.com/drive/v3',
  trashFile: vi.fn(async () => undefined),
}))

vi.mock('./driveClient', () => ({
  createFolder: vi.fn(),
  ensureFolder: vi.fn(async () => ({ id: 'inbox-folder', name: 'Sin colección' })),
  ensureAppRootFolder: vi.fn(async () => ({ id: 'root', name: 'Kuromi Likes Your Drawings' })),
  findFolderByName: vi.fn(),
  INBOX_FOLDER_NAME: 'Sin colección',
}))

import { trashFile } from './driveImageClient'
import { findFolderByName } from './driveClient'
import {
  obraMainFileId,
  secuenciaFileIds,
  secuenciaMainFileId,
  syncObraIntoColeccionFolder,
  syncSecuenciaIntoColeccionFolder,
  trashColeccionFolder,
} from './collectionFolders'
import type { Obra } from '../gallery/store'

const coleccion: Coleccion = {
  schema: 1,
  id: 'col-1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  nombre: 'Verano',
  tipo: 'general',
  orden: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.setItem('gallery-root-id', 'root')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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

describe('trashColeccionFolder', () => {
  it('trashes the saved folder without touching the works inside', async () => {
    await trashColeccionFolder('token', { ...coleccion, driveFolderId: 'folder-1' })

    expect(trashFile).toHaveBeenCalledTimes(1)
    expect(trashFile).toHaveBeenCalledWith('token', 'folder-1')
    expect(findFolderByName).not.toHaveBeenCalled()
  })

  it('finds a legacy folder by name and collection id', async () => {
    ;(findFolderByName as any).mockResolvedValue({
      id: 'folder-2',
      name: 'Verano',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { id: coleccion.id },
    })

    await trashColeccionFolder('token', coleccion)

    expect(findFolderByName).toHaveBeenCalledWith('token', 'Verano', 'root')
    expect(trashFile).toHaveBeenCalledWith('token', 'folder-2')
  })

  it('does not trash a folder that belongs to another collection', async () => {
    ;(findFolderByName as any).mockResolvedValue({
      id: 'folder-3',
      name: 'Verano',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { id: 'other' },
    })

    await trashColeccionFolder('token', coleccion)

    expect(trashFile).not.toHaveBeenCalled()
  })
})

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

function stubPatchFetch() {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
    ok: true,
    json: async () => ({}),
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function patchedUrls(fetchMock: ReturnType<typeof stubPatchFetch>): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]))
}

describe('main file helpers', () => {
  it('returns the gallery file of the first obra file', () => {
    expect(obraMainFileId(obra)).toBe('gal-1')
    expect(obraMainFileId({ ...obra, archivos: [] })).toBeNull()
  })

  it('returns the encoded GIF for a sequence, falling back to the first frame', () => {
    const secuencia: Secuencia = {
      schema: 1,
      id: 's1',
      rev: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      titulo: 'Animación',
      fps: 12,
      bucle: true,
      frames: [{ id: 'f1', orden: 0, drive: { originalId: 'orig-1', galeriaId: 'gal-1' } }],
      mainFileId: 'gif-1',
      miniatura: '',
    }

    expect(secuenciaMainFileId(secuencia)).toBe('gif-1')
    expect(secuenciaMainFileId({ ...secuencia, mainFileId: undefined })).toBe('gal-1')
  })
})

describe('syncObraIntoColeccionFolder', () => {
  it('adds only the main drawing to the collection and removes it from the inbox', async () => {
    const fetchMock = stubPatchFetch()
    const conCarpeta: Coleccion = { ...coleccion, driveFolderId: 'col-folder' }

    await syncObraIntoColeccionFolder('token', conCarpeta, obra, true)

    const urls = patchedUrls(fetchMock)
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('/files/gal-1?addParents=col-folder')
    expect(urls[1]).toContain('/files/gal-1?removeParents=inbox-folder')
    expect(urls.join(' ')).not.toContain('orig-1')
    expect(urls.join(' ')).not.toContain('mini-1')
  })

  it('returns the main drawing to the inbox when it leaves its last collection', async () => {
    const fetchMock = stubPatchFetch()
    const conCarpeta: Coleccion = { ...coleccion, driveFolderId: 'col-folder' }

    await syncObraIntoColeccionFolder('token', conCarpeta, { ...obra, coleccionIds: [] }, false)

    const urls = patchedUrls(fetchMock)
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('/files/gal-1?removeParents=col-folder')
    expect(urls[1]).toContain('/files/gal-1?addParents=inbox-folder')
  })

  it('does not return it to the inbox while it still belongs to another collection', async () => {
    const fetchMock = stubPatchFetch()
    const conCarpeta: Coleccion = { ...coleccion, driveFolderId: 'col-folder' }

    await syncObraIntoColeccionFolder('token', conCarpeta, { ...obra, coleccionIds: ['otra'] }, false)

    expect(patchedUrls(fetchMock)).toHaveLength(1)
    expect(patchedUrls(fetchMock)[0]).toContain('removeParents=col-folder')
  })
})

describe('syncSecuenciaIntoColeccionFolder', () => {
  const secuencia: Secuencia = {
    schema: 1,
    id: 's1',
    rev: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    titulo: 'Animación',
    fps: 12,
    bucle: true,
    frames: [{ id: 'f1', orden: 0, drive: { originalId: 'orig-1', galeriaId: 'gal-1' } }],
    mainFileId: 'gif-1',
    miniatura: '',
    coleccionIds: [],
  }

  it('moves only the encoded GIF into the collection and out of the inbox', async () => {
    const fetchMock = stubPatchFetch()
    const conCarpeta: Coleccion = { ...coleccion, driveFolderId: 'col-folder' }

    await syncSecuenciaIntoColeccionFolder('token', conCarpeta, secuencia, true)

    const urls = patchedUrls(fetchMock)
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('/files/gif-1?addParents=col-folder')
    expect(urls[1]).toContain('/files/gif-1?removeParents=inbox-folder')
  })
})
