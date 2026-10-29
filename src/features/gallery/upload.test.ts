import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../drive/driveClient', () => ({
  ensureDriveStructure: vi.fn(async () => ({
    rootId: 'root',
    internoId: 'id-_interno',
    archivosId: 'id-archivos',
    originalesId: 'id-originales',
    galeriaId: 'id-galeria',
    miniaturasId: 'id-miniaturas',
    obrasId: 'id-obras',
    coleccionesId: 'id-colecciones',
    secuenciasId: 'id-secuencias',
    entregasId: 'id-entregas',
    inboxId: 'id-inbox',
  })),
}))

vi.mock('../../lib/image/imageProcessor', () => ({
  fileToBitmap: vi.fn(),
  createMiniDataUrl: vi.fn(),
  imageExtension: vi.fn(),
  processImage: vi.fn(),
}))

import { ensureDriveStructure } from '../drive/driveClient'
import { notifyDriveAuthError } from '../drive/driveHttp'
import { clearFolderCache, getFolderIds } from './upload'

const expectedFolders = {
  rootId: 'root',
  archivosId: 'id-archivos',
  originalesId: 'id-originales',
  galeriaId: 'id-galeria',
  miniaturasId: 'id-miniaturas',
  datosId: 'id-_interno',
  obrasId: 'id-obras',
  coleccionesId: 'id-colecciones',
  secuenciasId: 'id-secuencias',
  entregasId: 'id-entregas',
  inboxId: 'id-inbox',
}

beforeEach(() => {
  vi.clearAllMocks()
  clearFolderCache()
})

describe('getFolderIds', () => {
  it('resolves the folder tree once and reuses it', async () => {
    const first = await getFolderIds('token-1')
    expect(first).toEqual(expectedFolders)
    expect(ensureDriveStructure).toHaveBeenCalledTimes(1)

    const second = await getFolderIds('token-2')
    expect(second).toEqual(first)
    expect(ensureDriveStructure).toHaveBeenCalledTimes(1)
  })

  it('reloads the folder tree after an expired session', async () => {
    await getFolderIds('token-1')
    notifyDriveAuthError()
    const refreshed = await getFolderIds('token-1')

    expect(refreshed).toEqual(expectedFolders)
    expect(ensureDriveStructure).toHaveBeenCalledTimes(2)
  })
})
