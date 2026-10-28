import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../drive/driveClient', () => ({
  findRootFolder: vi.fn(async () => ({ id: 'root', name: 'Kuromi likes your drawings' })),
  createFolder: vi.fn(),
}))

vi.mock('../../lib/image/imageProcessor', () => ({
  fileToBitmap: vi.fn(),
  createMiniDataUrl: vi.fn(),
  imageExtension: vi.fn(),
  processImage: vi.fn(),
}))

import { notifyDriveAuthError } from '../drive/driveHttp'
import { clearFolderCache, getFolderIds } from './upload'

function stubFolderFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const query = url.searchParams.get('q') || ''
    const name = /name='([^']+)'/.exec(query)?.[1] || 'unknown'
    return {
      ok: true,
      json: async () => ({ files: [{ id: `id-${name}`, name }] }),
    } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const expectedFolders = {
  rootId: 'root',
  archivosId: 'id-archivos',
  originalesId: 'id-originales',
  galeriaId: 'id-galeria',
  miniaturasId: 'id-miniaturas',
  datosId: 'id-_datos',
  obrasId: 'id-obras',
  coleccionesId: 'id-colecciones',
  secuenciasId: 'id-secuencias',
  entregasId: 'id-entregas',
}

beforeEach(() => {
  clearFolderCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getFolderIds', () => {
  it('resolves the folder tree once and reuses it', async () => {
    const fetchMock = stubFolderFetch()

    const first = await getFolderIds('token-1')
    expect(first).toEqual(expectedFolders)
    expect(fetchMock).toHaveBeenCalledTimes(9)

    const second = await getFolderIds('token-2')
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(9)
  })

  it('reloads the folder tree after an expired session', async () => {
    const fetchMock = stubFolderFetch()

    await getFolderIds('token-1')
    notifyDriveAuthError()
    const refreshed = await getFolderIds('token-1')

    expect(refreshed).toEqual(expectedFolders)
    expect(fetchMock).toHaveBeenCalledTimes(18)
  })
})
