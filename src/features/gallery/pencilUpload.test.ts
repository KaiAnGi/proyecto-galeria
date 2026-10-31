import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../auth/googleAuth', () => ({
  ensureToken: vi.fn(async () => 'token-1'),
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

import { ensureToken } from '../auth/googleAuth'
import { uploadBlob } from '../drive/driveImageClient'
import { encodeGif } from '../../lib/image/gifEncoder'
import { processImage } from '../../lib/image/imageProcessor'
import type { Secuencia } from './secuencias'
import { uploadAppendedFrames, uploadFrames } from './pencilUpload'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('uploadFrames', () => {
  it('uploads every frame, the gif and then the originals', async () => {
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
    expect(result.frames[0].drive.originalId).toBeUndefined()
    expect(result.frames[0].drive.galeriaId).toContain('.webp')
    expect(result.frames[0].miniDataUrl).toBe('data:image/webp;base64,AAAA')
    expect(result.mainFileId).toContain('Mi animación')
    expect(result.mainFileId).toContain('.gif')
    expect(progress).toEqual([
      [0, 2],
      [1, 2],
      [2, 2],
    ])
    expect(uploadBlob).toHaveBeenCalledTimes(3)

    const originalsProgress: Array<[number, number]> = []
    const originals = await result.uploadOriginals({
      onProgress: (done, total) => originalsProgress.push([done, total]),
    })

    expect(originals.failed).toBe(0)
    expect(originals.frames[0].drive.originalId).toContain('-original')
    expect(originalsProgress.at(-1)).toEqual([2, 2])
    expect(uploadBlob).toHaveBeenCalledTimes(5)

    const originalCalls = vi
      .mocked(uploadBlob)
      .mock.calls.filter(([, , name]) => name.endsWith('-original'))
    expect(originalCalls).toHaveLength(2)
    expect(originalCalls[0][3]).toEqual(['original'])
    expect(originalCalls[0][4]).toMatchObject({ kind: 'original' })
  })

  it('skips the originals when the sequence is gone', async () => {
    const files = [new File(['a'], 'frame-1.png', { type: 'image/png' })]

    const result = await uploadFrames(files, { id: 'secuencia-1', titulo: 'Mi animación', fps: 12 })
    const originals = await result.uploadOriginals({ shouldContinue: () => false })

    expect(originals.failed).toBe(0)
    expect(uploadBlob).toHaveBeenCalledTimes(2)
  })

  it('asks for a token for every upload step', async () => {
    const files = [
      new File(['a'], 'frame-1.png', { type: 'image/png' }),
      new File(['b'], 'frame-2.png', { type: 'image/png' }),
    ]

    await uploadFrames(files, { id: 'secuencia-1', titulo: 'Mi animación', fps: 12 })

    expect(ensureToken).toHaveBeenCalledTimes(4)
    for (const [token] of vi.mocked(uploadBlob).mock.calls) {
      expect(token).toBeTruthy()
    }
  })

  it('passes the loop preference to the gif encoder', async () => {
    const files = [new File(['a'], 'frame-1.png', { type: 'image/png' })]

    await uploadFrames(files, { id: 'secuencia-1', titulo: 'Mi animación', fps: 12, loop: false })

    expect(encodeGif).toHaveBeenCalledWith([expect.any(Blob)], 12, false)
  })
})

describe('uploadAppendedFrames', () => {
  const sequence: Secuencia = {
    schema: 1,
    id: 'secuencia-1',
    rev: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    titulo: 'Mi animación',
    fps: 12,
    bucle: true,
    frames: [
      { id: 'a', orden: 0, drive: { galeriaId: 'gal-a' } },
      { id: 'b', orden: 1, drive: { galeriaId: 'gal-b' } },
    ],
    mainFileId: 'gif-1',
    miniatura: '',
  }

  it('uploads only the new frames and keeps their order', async () => {
    const file = new File(['c'], 'frame-3.png', { type: 'image/png' })

    const result = await uploadAppendedFrames(sequence, [file])

    expect(result.frames).toHaveLength(1)
    expect(result.frames[0].orden).toBe(2)
    expect(processImage).toHaveBeenCalledWith(expect.anything(), 1024, 0.72, false)
    expect(encodeGif).not.toHaveBeenCalled()
    expect(uploadBlob).toHaveBeenCalledTimes(1)
  })

  it('ignores an append with no files', async () => {
    await expect(uploadAppendedFrames(sequence, [])).rejects.toThrow('No frames to upload')
    expect(uploadBlob).not.toHaveBeenCalled()
  })
})
