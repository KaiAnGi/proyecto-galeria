import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./collectionFolders', () => ({
  getRootFolderId: vi.fn(async () => 'root'),
}))

vi.mock('./driveClient', () => ({
  createFolder: vi.fn(),
  findFolderByName: vi.fn(async () => null),
  renameFile: vi.fn(async () => undefined),
}))

import { createFolder, findFolderByName, renameFile } from './driveClient'
import { ensureAnimationFolders } from './animationFolders'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(findFolderByName).mockResolvedValue(null)
  vi.mocked(createFolder).mockImplementation(async (_token, name, _parents, appProps) => ({
    id: appProps?.kind === 'animacion' ? 'folder-new' : name === 'Fotogramas' ? 'frames-new' : 'originals-new',
    name,
    mimeType: FOLDER_MIME,
    appProperties: appProps,
  }))
})

describe('ensureAnimationFolders', () => {
  it('renames an existing animation folder and reuses its child folders', async () => {
    vi.mocked(findFolderByName).mockImplementation(async (_token, name) =>
      name === 'Fotogramas'
        ? { id: 'frames-existing', name, mimeType: FOLDER_MIME }
        : name === 'Originales'
          ? { id: 'originals-existing', name, mimeType: FOLDER_MIME }
          : null,
    )

    const result = await ensureAnimationFolders('token', 'sec-1', 'Olas', 'folder-1')

    expect(renameFile).toHaveBeenCalledWith('token', 'folder-1', 'Olas')
    expect(result).toEqual({
      folderId: 'folder-1',
      folderName: 'Olas',
      framesFolderId: 'frames-existing',
      originalsFolderId: 'originals-existing',
    })
    expect(createFolder).not.toHaveBeenCalled()
  })

  it('creates a visible folder with a suffix when the title is already taken', async () => {
    vi.mocked(findFolderByName).mockImplementation(async (_token, name, parentId) =>
      parentId === 'root' && name === 'Olas'
        ? { id: 'other-folder', name, mimeType: FOLDER_MIME, appProperties: { id: 'other' } }
        : null,
    )

    const result = await ensureAnimationFolders('token', 'abc123', 'Olas')

    expect(result.folderId).toBe('folder-new')
    expect(result.folderName).toBe('Olas (c123)')
    expect(createFolder).toHaveBeenCalledWith('token', 'Olas (c123)', ['root'], {
      kind: 'animacion',
      id: 'abc123',
    })
    expect(createFolder).toHaveBeenCalledWith('token', 'Fotogramas', ['folder-new'], {
      kind: 'animacion-fotogramas',
      id: 'abc123',
    })
    expect(createFolder).toHaveBeenCalledWith('token', 'Originales', ['folder-new'], {
      kind: 'animacion-originales',
      id: 'abc123',
    })
  })

  it('reuses a folder found by name when it belongs to the same animation', async () => {
    vi.mocked(findFolderByName).mockImplementation(async (_token, name, parentId) =>
      parentId === 'root' && name === 'Olas'
        ? { id: 'folder-found', name, mimeType: FOLDER_MIME, appProperties: { id: 'sec-1' } }
        : null,
    )

    const result = await ensureAnimationFolders('token', 'sec-1', 'Olas')

    expect(result.folderId).toBe('folder-found')
    expect(createFolder).not.toHaveBeenCalledWith('token', 'Olas', expect.anything(), expect.anything())
  })
})
