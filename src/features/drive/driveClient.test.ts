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
    fetch.mockImplementation(async (input: RequestInfo | URL) => {
      const query = decodeURIComponent(new URL(String(input)).searchParams.get('q') || '')
      if (query.includes("key='kind'")) {
        return jsonResponse({ files: [{ id: 'existing-root', name: 'Kuromi Likes Your Drawings' }] })
      }
      const name = /name='([^']+)'/.exec(query)?.[1] || 'unknown'
      return jsonResponse({
        files: [{ id: `id-${name}`, name, mimeType: 'application/vnd.google-apps.folder' }],
      })
    })
    vi.stubGlobal('fetch', fetch)

    expect(await initDriveStructure('token')).toBe('existing-root')
    const posts = fetch.mock.calls.filter((call) => call[1]?.method === 'POST')
    expect(posts).toHaveLength(0)
  })

  it('renames the legacy root folder instead of creating a new one', async () => {
    const fetch = fetchMock()
    fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') return jsonResponse({ id: 'existing-root', name: 'Kuromi Likes Your Drawings' })
      const query = decodeURIComponent(new URL(String(input)).searchParams.get('q') || '')
      if (query.includes("key='kind'")) {
        return jsonResponse({ files: [{ id: 'existing-root', name: 'Mis obras' }] })
      }
      const name = /name='([^']+)'/.exec(query)?.[1] || 'unknown'
      return jsonResponse({
        files: [{ id: `id-${name}`, name, mimeType: 'application/vnd.google-apps.folder' }],
      })
    })
    vi.stubGlobal('fetch', fetch)

    expect(await initDriveStructure('token')).toBe('existing-root')

    const rename = fetch.mock.calls.find((call) => call[1]?.method === 'PATCH')
    expect(rename).toBeDefined()
    expect(JSON.parse(rename?.[1]?.body as string)).toEqual({ name: 'Kuromi Likes Your Drawings' })
  })

  it('migrates the legacy _datos and root archivos folders', async () => {
    const fetch = fetchMock()
    fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') return jsonResponse({ id: 'patched' })
      const query = decodeURIComponent(new URL(String(input)).searchParams.get('q') || '')
      if (query.includes("key='kind'")) {
        return jsonResponse({ files: [{ id: 'root-1', name: 'Kuromi Likes Your Drawings' }] })
      }
      const name = /name='([^']+)'/.exec(query)?.[1] || 'unknown'
      const parent = /'([^']+)' in parents/.exec(query)?.[1] || ''
      if (name === '_interno' && parent === 'root-1') return jsonResponse({ files: [] })
      if (name === '_datos' && parent === 'root-1') {
        return jsonResponse({
          files: [{ id: 'legacy-datos', name: '_datos', mimeType: 'application/vnd.google-apps.folder' }],
        })
      }
      if (name === 'archivos' && parent === 'legacy-datos') return jsonResponse({ files: [] })
      if (name === 'archivos' && parent === 'root-1') {
        return jsonResponse({
          files: [{ id: 'legacy-archivos', name: 'archivos', mimeType: 'application/vnd.google-apps.folder' }],
        })
      }
      return jsonResponse({
        files: [{ id: `id-${name}`, name, mimeType: 'application/vnd.google-apps.folder' }],
      })
    })
    vi.stubGlobal('fetch', fetch)

    expect(await initDriveStructure('token')).toBe('root-1')

    const patches = fetch.mock.calls.filter((call) => call[1]?.method === 'PATCH')
    const rename = patches.find((call) => String(call[0]).includes('/files/legacy-datos'))
    expect(JSON.parse(rename?.[1]?.body as string)).toEqual({ name: '_interno' })
    const move = patches.find((call) => String(call[0]).includes('/files/legacy-archivos'))
    expect(String(move?.[0])).toContain('addParents=legacy-datos')
    expect(String(move?.[0])).toContain('removeParents=root-1')
  })

  it('creates the root and every subfolder on a fresh Drive', async () => {
    const fetch = fetchMock()
    fetch.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return jsonResponse({ id: 'new-id', name: JSON.parse(String(init.body)).name })
      }
      return jsonResponse({ files: [] })
    })
    vi.stubGlobal('fetch', fetch)

    const rootId = await initDriveStructure('token')

    expect(rootId).toBe('new-id')
    const createdNames = fetch.mock.calls
      .filter((call) => call[1]?.method === 'POST')
      .map((call) => JSON.parse(call[1].body).name)
    expect(createdNames).toHaveLength(11)
    expect(createdNames).toEqual(
      expect.arrayContaining([
        'Kuromi Likes Your Drawings',
        '_interno',
        'Sin colección',
        'archivos',
        'obras',
        'colecciones',
        'secuencias',
        'entregas',
        'originales',
        'galeria',
        'miniaturas',
      ]),
    )
  })
})

describe('saveTestFile', () => {
  it('uploads a multipart config.json inside the internal folder', async () => {
    const fetch = fetchMock()
    fetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ id: 'config-1', name: 'config.json' })
      const query = decodeURIComponent(new URL(String(input)).searchParams.get('q') || '')
      if (query.includes("key='kind'")) {
        return jsonResponse({ files: [{ id: 'root-1', name: 'Kuromi Likes Your Drawings' }] })
      }
      const name = /name='([^']+)'/.exec(query)?.[1] || 'unknown'
      return jsonResponse({
        files: [{ id: `id-${name}`, name, mimeType: 'application/vnd.google-apps.folder' }],
      })
    })
    vi.stubGlobal('fetch', fetch)

    const saved = await saveTestFile('token')

    expect(saved.id).toBe('config-1')
    const uploadCall = fetch.mock.calls.at(-1)
    expect(uploadCall).toBeDefined()
    const [uploadUrl, uploadInit] = uploadCall!
    expect(String(uploadUrl)).toContain('uploadType=multipart')
    expect(uploadInit?.method).toBe('POST')
    expect(uploadInit?.body).toBeInstanceOf(FormData)
    if (!(uploadInit?.body instanceof FormData)) throw new Error('Missing multipart form')
    const metadata = uploadInit.body.get('metadata') as Blob
    expect(JSON.parse(await metadata.text())).toMatchObject({ parents: ['id-_interno'] })
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
