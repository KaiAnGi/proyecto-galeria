import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  findRootFolder,
  createFolder,
  initDriveStructure,
  saveTestFile,
  loadTestFile,
} from './driveClient'

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => data } as unknown as Response
}

function fetchMock() {
  return vi.fn()
}

describe('findRootFolder', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('queries Drive by appProperties kind=root and returns the first file', async () => {
    const fetch = fetchMock()
    fetch.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'root-1', name: 'Mis obras' }] }))
    vi.stubGlobal('fetch', fetch)

    const root = await findRootFolder('token')

    expect(root?.id).toBe('root-1')
    const calledUrl = String(fetch.mock.calls[0][0])
    expect(calledUrl).toContain('/drive/v3/files?q=')
    expect(decodeURIComponent(calledUrl)).toContain("appProperties has { key='kind' and value='root' }")
    expect(decodeURIComponent(calledUrl)).toContain('trashed=false')
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token')
  })

  it('returns null when there is no root folder yet', async () => {
    const fetch = fetchMock()
    fetch.mockResolvedValueOnce(jsonResponse({ files: [] }))
    vi.stubGlobal('fetch', fetch)

    expect(await findRootFolder('token')).toBeNull()
  })

  it('throws when Drive responds with an error', async () => {
    const fetch = fetchMock()
    fetch.mockResolvedValueOnce(jsonResponse({}, false, 403))
    vi.stubGlobal('fetch', fetch)

    await expect(findRootFolder('token')).rejects.toThrow('403')
  })
})

describe('createFolder', () => {
  it('POSTs folder metadata with parents and appProperties', async () => {
    const fetch = fetchMock()
    fetch.mockResolvedValueOnce(jsonResponse({ id: 'folder-1', name: '_datos' }))
    vi.stubGlobal('fetch', fetch)

    const folder = await createFolder('token', '_datos', ['root-1'], { kind: 'datos' })

    expect(folder.id).toBe('folder-1')
    const init = fetch.mock.calls[0][1]
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      name: '_datos',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['root-1'],
      appProperties: { kind: 'datos' },
    })
  })
})

describe('initDriveStructure', () => {
  it('returns the existing root id without creating anything', async () => {
    const fetch = fetchMock()
    fetch.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'existing-root' }] }))
    vi.stubGlobal('fetch', fetch)

    expect(await initDriveStructure('token')).toBe('existing-root')
    expect(fetch.mock.calls.length).toBe(1)
  })

  it('creates the root and every subfolder on a fresh Drive', async () => {
    const fetch = fetchMock()
    fetch.mockResolvedValueOnce(jsonResponse({ files: [] }))
    fetch.mockImplementation(async () => jsonResponse({ id: 'new-id' }))
    vi.stubGlobal('fetch', fetch)

    const rootId = await initDriveStructure('token')

    expect(rootId).toBe('new-id')
    const createdNames = fetch.mock.calls
      .filter((call) => call[1]?.method === 'POST')
      .map((call) => JSON.parse(call[1].body).name)
    expect(createdNames).toEqual([
      'Mis obras',
      '_datos',
      'obras',
      'colecciones',
      'secuencias',
      'entregas',
      'archivos',
      'originales',
      'galeria',
      'miniaturas',
    ])
  })
})

describe('saveTestFile', () => {
  it('uploads a multipart config.json inside _datos', async () => {
    const fetch = fetchMock()
    fetch
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'root-1' }] }))
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'datos-1', name: '_datos' }] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'config-1', name: 'config.json' }))
    vi.stubGlobal('fetch', fetch)

    const saved = await saveTestFile('token')

    expect(saved.id).toBe('config-1')
    const uploadCall = fetch.mock.calls[2]
    expect(String(uploadCall[0])).toContain('uploadType=multipart')
    expect(uploadCall[1].method).toBe('POST')
    expect(uploadCall[1].body).toBeInstanceOf(FormData)
  })
})

describe('loadTestFile', () => {
  it('downloads config.json through alt=media', async () => {
    const payload = { schema: 1, rev: 1, test: true, message: 'Hola desde Mi Galería' }
    const fetch = fetchMock()
    fetch
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'root-1' }] }))
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'file-config', name: 'config.json' }] }))
      .mockResolvedValueOnce(jsonResponse(payload))
    vi.stubGlobal('fetch', fetch)

    const loaded = await loadTestFile('token')

    expect(loaded).toEqual(payload)
    expect(String(fetch.mock.calls[2][0])).toContain('/files/file-config?alt=media')
  })

  it('throws when the test file is missing', async () => {
    const fetch = fetchMock()
    fetch
      .mockResolvedValueOnce(jsonResponse({ files: [{ id: 'root-1' }] }))
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
    vi.stubGlobal('fetch', fetch)

    await expect(loadTestFile('token')).rejects.toThrow('Archivo de prueba no encontrado')
  })
})
