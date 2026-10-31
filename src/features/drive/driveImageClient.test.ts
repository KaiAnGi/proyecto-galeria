import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateBlob, uploadBlob } from './driveImageClient'
import { onDriveAuthError } from './driveHttp'

function response(status: number, body: unknown, headers?: Record<string, string>): Response {
  const value = {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
    clone: () => value,
  }
  return value as unknown as Response
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('uploadBlob', () => {
  it('retries a rate-limited upload with backoff', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429, { error: 'rateLimitExceeded' }))
      .mockResolvedValueOnce(response(200, { id: 'file-1', name: 'original' }))
    vi.stubGlobal('fetch', fetchMock)

    const upload = uploadBlob('token', new Blob(['image']), 'original', ['parent'])
    await vi.advanceTimersByTimeAsync(400)

    await expect(upload).resolves.toEqual({ id: 'file-1', name: 'original' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a normal permission error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(403, { error: 'forbidden' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadBlob('token', new Blob(['image']), 'original', ['parent'])).rejects.toThrow(
      'Upload error: 403',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('updates an existing file with a media patch', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(200, { id: 'file-1', name: 'animacion.gif' }))
    vi.stubGlobal('fetch', fetchMock)
    const blob = new Blob(['gif'], { type: 'image/gif' })

    await expect(updateBlob('token', 'file-1', blob)).resolves.toEqual({ id: 'file-1', name: 'animacion.gif' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toContain('/files/file-1?uploadType=media')
    expect(options.method).toBe('PATCH')
    expect(options.headers['Content-Type']).toBe('image/gif')
    expect(options.body).toBe(blob)
  })

  it('retries a rate-limited media patch', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429, { error: 'rateLimitExceeded' }))
      .mockResolvedValueOnce(response(200, { id: 'file-1', name: 'animacion.gif' }))
    vi.stubGlobal('fetch', fetchMock)

    const update = updateBlob('token', 'file-1', new Blob(['gif'], { type: 'image/gif' }))
    await vi.advanceTimersByTimeAsync(400)

    await expect(update).resolves.toEqual({ id: 'file-1', name: 'animacion.gif' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('reports an expired session so cached folders can be refreshed', async () => {
    const listener = vi.fn()
    const unsubscribe = onDriveAuthError(listener)
    const fetchMock = vi.fn().mockResolvedValueOnce(response(401, { error: 'unauthorized' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(uploadBlob('token', new Blob(['image']), 'original', ['parent'])).rejects.toThrow(
      'Upload error: 401',
    )
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
  })
})
