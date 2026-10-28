import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Coleccion } from '../gallery/store'
import type { Secuencia } from '../gallery/secuencias'

vi.mock('./driveImageClient', () => ({
  DRIVE_API: 'https://www.googleapis.com/drive/v3',
  trashFile: vi.fn(async () => undefined),
}))

vi.mock('./driveClient', () => ({
  createFolder: vi.fn(),
  ensureFolder: vi.fn(),
  findFolderByName: vi.fn(),
  findRootFolder: vi.fn(),
}))

import { trashFile } from './driveImageClient'
import { findFolderByName } from './driveClient'
import { secuenciaFileIds, trashColeccionFolder } from './collectionFolders'

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
    ;(findFolderByName as any).mockImplementation(async (_token: string, name: string) =>
      name === 'Colecciones'
        ? { id: 'colecciones-root', name }
        : { id: 'folder-2', name, appProperties: { id: coleccion.id } },
    )

    await trashColeccionFolder('token', coleccion)

    expect(findFolderByName).toHaveBeenCalledWith('token', 'Colecciones', 'root')
    expect(findFolderByName).toHaveBeenCalledWith('token', 'Verano', 'colecciones-root')
    expect(trashFile).toHaveBeenCalledWith('token', 'folder-2')
  })

  it('does not trash a folder that belongs to another collection', async () => {
    ;(findFolderByName as any).mockImplementation(async (_token: string, name: string) =>
      name === 'Colecciones'
        ? { id: 'colecciones-root', name }
        : { id: 'folder-3', name, appProperties: { id: 'other' } },
    )

    await trashColeccionFolder('token', coleccion)

    expect(trashFile).not.toHaveBeenCalled()
  })
})
