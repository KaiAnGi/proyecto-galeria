import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../auth/googleAuth', () => ({
  ensureToken: vi.fn(async () => 'token-1'),
  getToken: vi.fn(() => 'token-1'),
}))

vi.mock('../../lib/image/imageProcessor', () => ({
  fileToBitmap: vi.fn(async () => ({ width: 100, height: 80, close: vi.fn() })),
  processImage: vi.fn(async () => ({
    galleryBlob: new Blob(['gallery'], { type: 'image/webp' }),
    miniBlob: new Blob(['mini'], { type: 'image/webp' }),
    miniDataUrl: 'data:image/webp;base64,AAAA',
    width: 100,
    height: 80,
  })),
  imageExtension: vi.fn(() => 'webp'),
}))

vi.mock('../../lib/image/gifEncoder', () => ({
  encodeGif: vi.fn(async () => new Blob(['gif'], { type: 'image/gif' })),
}))

vi.mock('../drive/driveImageClient', () => ({
  uploadBlob: vi.fn(async (_token: string, _blob: Blob, name: string) => ({ id: `drive-${name}`, name })),
}))

vi.mock('./upload', () => ({
  getFolderIds: vi.fn(async () => ({
    miniaturasId: 'mini',
    originalesId: 'original',
    galeriaId: 'galeria',
    inboxId: 'inbox',
  })),
}))

import { ensureToken, getToken } from '../auth/googleAuth'
import { uploadBlob } from '../drive/driveImageClient'
import { uploadFrames } from './pencilUpload'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadFrames', () => {
  it('uploads every frame and reports progress', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['mini'], { type: 'image/webp' }) })),
    )
    const files = [
      new File(['a'], 'frame-1.png', { type: 'image/png' }),
      new File(['b'], 'frame-2.png', { type: 'image/png' }),
    ]
    const progress: Array<[number, number]> = []

    const result = await uploadFrames(
      files,
      { id: 'secuencia-1', titulo: 'Mi animación', fps: 12 },
      (done, total) => progress.push([done, total]),
    )

    expect(result.frames).toHaveLength(2)
    expect(result.frames.map((frame) => frame.orden)).toEqual([0, 1])
    expect(result.frames[0].drive.originalId).toContain('-original')
    expect(result.frames[0].drive.galeriaId).toContain('.webp')
    expect(result.frames[0].miniDataUrl).toBe('data:image/webp;base64,AAAA')
    expect(result.mainFileId).toContain('Mi animación')
    expect(result.mainFileId).toContain('.gif')
    expect(progress).toEqual([
      [0, 2],
      [1, 2],
    ])
    expect(uploadBlob).toHaveBeenCalledTimes(7)
  })

  it('renews the token between frames when it expires', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ blob: async () => new Blob(['mini'], { type: 'image/webp' }) })),
    )
    vi.mocked(ensureToken).mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2')
    vi.mocked(getToken).mockReturnValueOnce('token-1').mockReturnValueOnce(null)
    const files = [new File(['a'], 'frame-1.png', { type: 'image/png' }), new File(['b'], 'frame-2.png', { type: 'image/png' })]

    await uploadFrames(files, { id: 'secuencia-1', titulo: 'Mi animación', fps: 12 })

    expect(ensureToken).toHaveBeenCalledTimes(2)
  })
})
