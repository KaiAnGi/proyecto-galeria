import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./saveQueue', () => ({
  enqueueSave: vi.fn(async (operation: (token: string) => Promise<void>) => operation('token')),
}))

vi.mock('../drive/animationFolders', () => ({
  ensureAnimationFolders: vi.fn(async () => ({
    folderId: 'folder-1',
    folderName: 'Olas',
    framesFolderId: 'frames-folder',
    originalsFolderId: 'originals-folder',
  })),
}))

vi.mock('../drive/collectionFolders', () => ({
  addFilesToFolder: vi.fn(async () => undefined),
}))

vi.mock('../drive/driveImageClient', () => ({
  downloadFileAsBlob: vi.fn(),
  trashFile: vi.fn(async () => undefined),
  uploadBlob: vi.fn(),
}))

vi.mock('./persistence', () => ({
  saveSecuencia: vi.fn(async () => undefined),
}))

vi.mock('./sequenceVideo', () => ({
  exportSequenceVideo: vi.fn(async () => ({
    blob: new Blob(['video'], { type: 'video/mp4' }),
    mime: 'video/mp4',
    extension: 'mp4',
  })),
}))

vi.mock('../../lib/image/imageProcessor', () => ({
  blobToThumbnailDataUrl: vi.fn(async () => 'data:thumb'),
  imageExtension: vi.fn(() => 'webp'),
}))

import { blobToThumbnailDataUrl } from '../../lib/image/imageProcessor'
import { ensureAnimationFolders } from '../drive/animationFolders'
import { addFilesToFolder } from '../drive/collectionFolders'
import { downloadFileAsBlob, trashFile, uploadBlob } from '../drive/driveImageClient'
import { saveSecuencia } from './persistence'
import { exportSequenceVideo } from './sequenceVideo'
import { useGalleryStore } from './store'
import type { Secuencia } from './secuencias'
import { saveSequenceDraft } from './sequenceSave'
import type { SequenceDraft } from './sequenceDrafts'

const previous: Secuencia = {
  schema: 1,
  id: 'draft-1',
  rev: 3,
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Olas',
  fps: 12,
  bucle: true,
  frames: [
    { id: 'a', orden: 0, drive: { galeriaId: 'gal-a', originalId: 'orig-a' } },
    { id: 'b', orden: 1, drive: { galeriaId: 'gal-b' } },
    { id: 'c', orden: 2, drive: { galeriaId: 'gal-c', originalId: 'orig-c' } },
  ],
  mainFileId: 'video-old',
  folderId: 'folder-old',
  miniatura: '',
  coleccionIds: ['col-1'],
}

function baseDraft(frames: SequenceDraft['frames']): SequenceDraft {
  return {
    id: 'draft-1',
    titulo: '  Olas / 1  ',
    fps: 99,
    bucle: false,
    frames,
    miniatura: '',
    coleccionIds: [],
    dirty: true,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  useGalleryStore.getState().hydrate({ secuencias: [], obras: [], colecciones: [], entregas: [] })
  vi.mocked(uploadBlob).mockImplementation(async (_token, _blob, name) => {
    if (name.endsWith('.mp4')) return { id: 'video-new', name }
    if (name.includes('original')) return { id: `orig-${name.slice(0, 2)}`, name }
    return { id: `gal-${name.slice(0, 2)}`, name }
  })
})

describe('saveSequenceDraft', () => {
  it('creates the video and folders, then uploads new frames and originals', async () => {
    const draft = baseDraft([
      { id: 'a', orden: 0, blob: new Blob(['a'], { type: 'image/webp' }), original: new File(['a'], 'a.png') },
      { id: 'b', orden: 1, blob: new Blob(['b'], { type: 'image/webp' }), original: new File(['b'], 'b.png') },
    ])

    const result = await saveSequenceDraft(draft)

    expect(ensureAnimationFolders).toHaveBeenCalledWith('token', 'draft-1', 'Olas / 1', undefined)
    expect(exportSequenceVideo).toHaveBeenCalledWith(
      [expect.any(Blob), expect.any(Blob)],
      24,
      expect.any(Function),
      { background: undefined, width: undefined, height: undefined },
    )
    expect(uploadBlob).toHaveBeenCalledWith('token', expect.any(Blob), 'Olas 1.mp4', ['folder-1'], {
      kind: 'secuencia-video',
      id: 'draft-1',
    })
    expect(uploadBlob).toHaveBeenCalledWith('token', expect.any(Blob), '01.webp', ['frames-folder'], {
      kind: 'frame',
      frameId: 'a',
      sequenceId: 'draft-1',
    })
    expect(uploadBlob).toHaveBeenCalledWith('token', expect.any(File), '01-original.png', ['originals-folder'], {
      kind: 'original',
      frameId: 'a',
      sequenceId: 'draft-1',
    })
    expect(saveSecuencia).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        id: 'draft-1',
        rev: 1,
        titulo: 'Olas / 1',
        fps: 24,
        bucle: false,
        mainFileId: 'video-new',
        folderId: 'folder-1',
        videoMime: 'video/mp4',
        miniatura: 'data:thumb',
        frames: [
          { id: 'a', orden: 0, drive: { galeriaId: 'gal-01', originalId: 'orig-01' } },
          { id: 'b', orden: 1, drive: { galeriaId: 'gal-02', originalId: 'orig-02' } },
        ],
      }),
    )
    expect(result.sequence.mainFileId).toBe('video-new')
    expect(useGalleryStore.getState().secuencias).toHaveLength(1)
  })

  it('reuses saved frames, moves them into the folders and trashes removed files', async () => {
    useGalleryStore.getState().hydrate({ secuencias: [previous], obras: [], colecciones: [], entregas: [] })
    vi.mocked(downloadFileAsBlob).mockImplementation(async (_token, id) => new Blob([id], { type: 'image/webp' }))
    const draft: SequenceDraft = {
      ...baseDraft([
        { id: 'a', orden: 0, existing: { galeriaId: 'gal-a', originalId: 'orig-a' } },
        { id: 'b', orden: 1, existing: { galeriaId: 'gal-b' } },
      ]),
      titulo: 'Olas',
      fps: 12,
      folderId: 'folder-old',
      mainFileId: 'video-old',
      coleccionIds: ['col-1'],
    }

    await saveSequenceDraft(draft)

    expect(downloadFileAsBlob).toHaveBeenCalledTimes(2)
    expect(uploadBlob).toHaveBeenCalledTimes(1)
    expect(addFilesToFolder).toHaveBeenCalledWith('token', ['gal-a'], 'frames-folder')
    expect(addFilesToFolder).toHaveBeenCalledWith('token', ['orig-a'], 'originals-folder')
    expect(addFilesToFolder).toHaveBeenCalledWith('token', ['gal-b'], 'frames-folder')
    expect(saveSecuencia).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        rev: 4,
        mainFileId: 'video-new',
        folderId: 'folder-1',
        coleccionIds: ['col-1'],
      }),
    )
    expect(trashFile).toHaveBeenCalledWith('token', 'gal-c')
    expect(trashFile).toHaveBeenCalledWith('token', 'orig-c')
    expect(trashFile).toHaveBeenCalledWith('token', 'video-old')
  })

  it('expands holds and repeats for the exported video and uses the cover frame', async () => {
    const draft: SequenceDraft = {
      ...baseDraft([
        { id: 'a', orden: 0, blob: new Blob(['a'], { type: 'image/webp' }) },
        { id: 'b', orden: 1, hold: 2, blob: new Blob(['b'], { type: 'image/webp' }) },
      ]),
      portadaFrameId: 'b',
      exportSettings: { repeats: 2, background: 'white', width: 720, height: 540 },
    }

    await saveSequenceDraft(draft)

    expect(exportSequenceVideo).toHaveBeenCalledWith(
      [expect.any(Blob), expect.any(Blob), expect.any(Blob), expect.any(Blob), expect.any(Blob), expect.any(Blob)],
      24,
      expect.any(Function),
      { background: 'white', width: 720, height: 540 },
    )
    expect(blobToThumbnailDataUrl).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('trashes uploaded files if saving fails partway through', async () => {
    vi.mocked(uploadBlob)
      .mockResolvedValueOnce({ id: 'video-new', name: 'Olas.mp4' })
      .mockRejectedValueOnce(new Error('upload failed'))
    const draft = baseDraft([{ id: 'a', orden: 0, blob: new Blob(['a'], { type: 'image/webp' }) }])

    await expect(saveSequenceDraft(draft)).rejects.toThrow('upload failed')

    expect(trashFile).toHaveBeenCalledWith('token', 'video-new')
    expect(trashFile).toHaveBeenCalledWith('token', 'folder-1')
    expect(saveSecuencia).not.toHaveBeenCalled()
  })
})
