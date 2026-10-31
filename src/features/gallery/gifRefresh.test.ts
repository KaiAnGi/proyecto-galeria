import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../auth/googleAuth', () => ({
  ensureToken: vi.fn(async () => 'token-1'),
}))

vi.mock('../drive/driveImageClient', () => ({
  downloadFileAsBlob: vi.fn(async (_token: string, id: string) => new Blob([id], { type: 'image/webp' })),
  updateBlob: vi.fn(async (_token: string, id: string) => ({ id, name: 'animacion.gif' })),
  uploadBlob: vi.fn(async () => ({ id: 'gif-new', name: 'animacion.gif' })),
  trashFile: vi.fn(async () => undefined),
}))

vi.mock('../../lib/image/gifEncoder', () => ({
  encodeGif: vi.fn(async () => new Blob(['gif'], { type: 'image/gif' })),
}))

vi.mock('./upload', () => ({
  getFolderIds: vi.fn(async () => ({
    originalesId: 'originales',
    galeriaId: 'galeria',
    inboxId: 'inbox',
  })),
}))

import { encodeGif } from '../../lib/image/gifEncoder'
import { downloadFileAsBlob, trashFile, updateBlob, uploadBlob } from '../drive/driveImageClient'
import { refreshSequenceGif } from './gifRefresh'
import type { Secuencia } from './secuencias'

const sequence: Secuencia = {
  schema: 1,
  id: 'sec-1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Olas',
  fps: 12,
  bucle: true,
  frames: [
    { id: 'b', orden: 1, drive: { galeriaId: 'gal-b' } },
    { id: 'a', orden: 0, drive: { galeriaId: 'gal-a' } },
  ],
  mainFileId: 'gif-old',
  miniatura: '',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('refreshSequenceGif', () => {
  it('downloads frames in order and updates the existing gif', async () => {
    const progress: Array<[number, number]> = []
    const stages: string[] = []

    const result = await refreshSequenceGif(sequence, {
      onProgress: (done, total) => progress.push([done, total]),
      onStage: (stage) => stages.push(stage),
    })

    expect(vi.mocked(downloadFileAsBlob).mock.calls.map(([, id]) => id)).toEqual(['gal-a', 'gal-b'])
    expect(encodeGif).toHaveBeenCalledWith([expect.any(Blob), expect.any(Blob)], 12, true)
    expect(updateBlob).toHaveBeenCalledWith('token-1', 'gif-old', expect.any(Blob))
    expect(uploadBlob).not.toHaveBeenCalled()
    expect(result).toEqual({ mainFileId: 'gif-old', signature: '12:1:a@0,b@1' })
    expect(progress.at(-1)).toEqual([2, 2])
    expect(stages).toEqual(['loading', 'encoding', 'uploading'])
  })

  it('reuses cached frame blobs', async () => {
    const cache = new Map<string, Blob>([['a', new Blob(['cached-a'])]])

    await refreshSequenceGif(sequence, { cachedBlobs: cache })

    expect(vi.mocked(downloadFileAsBlob).mock.calls.map(([, id]) => id)).toEqual(['gal-b'])
    expect(cache.has('b')).toBe(true)
  })

  it('uploads a replacement gif if the media patch fails', async () => {
    vi.mocked(updateBlob).mockRejectedValueOnce(new Error('Update error: 403'))

    const result = await refreshSequenceGif(sequence)

    expect(uploadBlob).toHaveBeenCalledTimes(1)
    expect(trashFile).toHaveBeenCalledWith('token-1', 'gif-old')
    expect(result.mainFileId).toBe('gif-new')
  })
})
