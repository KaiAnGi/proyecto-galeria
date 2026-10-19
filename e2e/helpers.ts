import type { Page } from '@playwright/test'

export const ECOSIA_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Ecosia/11.27.0'

/** Stubs Google Identity Services so the app can "connect" without a real Google account. */
export async function stubGis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    ;(window as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: { callback: (resp: { access_token?: string; expires_in?: number }) => void }) => ({
            requestAccessToken: () => config.callback({ access_token: 'e2e-token', expires_in: 3600 }),
          }),
        },
      },
    }
  })
  await page.route('**/accounts.google.com/gsi/client', (route) => route.fulfill({ body: '' }))
}

type StoredFile = {
  id: string
  name: string
  mimeType: string
  parents?: string[]
  appProperties?: Record<string, string>
  trashed?: boolean
  base64: string
}

/**
 * Replaces window.fetch with an in-memory Drive so upload/download/list round trips
 * really happen inside the browser. The state lives in sessionStorage so it survives
 * a page reload during a test.
 */
export async function stubDriveMemory(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const STORAGE_KEY = 'e2e-drive-files'
    let seq = 0
    let files: StoredFile[] = []
    try {
      files = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
      seq = files.length
    } catch {
      files = []
    }

    function save(): void {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(files))
      } catch {
        // ignore quota errors
      }
    }

    function toBase64(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer)
      let out = ''
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        out += String.fromCharCode(...bytes.subarray(i, i + chunk))
      }
      return btoa(out)
    }

    function fromBase64(b64: string): Uint8Array {
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      return bytes
    }

    function jsonResponse(data: unknown, status = 200): Response {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    function matches(file: StoredFile, q: string): boolean {
      if (q.includes('trashed=false') && file.trashed) return false
      const parent = q.match(/'([^']+)' in parents/)
      if (parent && !file.parents?.includes(parent[1])) return false
      const name = q.match(/name='([^']+)'/)
      if (name && file.name !== name[1]) return false
      const mime = q.match(/mimeType='([^']+)'/)
      if (mime && file.mimeType !== mime[1]) return false
      const kind = q.match(/value='([^']+)'/)
      if (kind && file.appProperties?.kind !== kind[1]) return false
      return true
    }

    function publicView(file: StoredFile): Omit<StoredFile, 'base64'> {
      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        parents: file.parents,
        appProperties: file.appProperties,
        trashed: file.trashed,
      }
    }

    const realFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (!url.includes('googleapis.com')) return realFetch(input, init)

      const method = (init?.method || (typeof input !== 'string' ? input.method : 'GET')).toUpperCase()
      const path = new URL(url).pathname

      if (url.includes('/upload/drive/v3/files') && method === 'POST') {
        const form = init?.body as FormData
        const meta = JSON.parse(await (form.get('metadata') as Blob).text())
        const file = form.get('file') as Blob
        const stored: StoredFile = {
          id: 'file-' + ++seq,
          name: meta.name,
          mimeType: file.type || 'application/octet-stream',
          parents: meta.parents,
          appProperties: meta.appProperties,
          base64: toBase64(await file.arrayBuffer()),
        }
        files.push(stored)
        save()
        return jsonResponse({
          id: stored.id,
          name: stored.name,
          mimeType: stored.mimeType,
          modifiedTime: new Date().toISOString(),
          appProperties: stored.appProperties,
        })
      }

      if (url.includes('/upload/drive/v3/files/') && method === 'PATCH') {
        const id = path.split('/').pop() as string
        const target = files.find((f) => f.id === id)
        const body = init?.body as Blob | undefined
        if (!target || !body) return jsonResponse({ error: 'not found' }, 404)
        target.base64 = toBase64(await body.arrayBuffer())
        save()
        return jsonResponse({ id: target.id, name: target.name, mimeType: target.mimeType })
      }

      if (path === '/drive/v3/files' && method === 'POST') {
        const body = JSON.parse(init?.body as string)
        const created: StoredFile = {
          id: 'folder-' + ++seq,
          name: body.name,
          mimeType: body.mimeType || 'application/json',
          parents: body.parents,
          appProperties: body.appProperties,
          base64: '',
        }
        files.push(created)
        save()
        return jsonResponse({ ...body, id: created.id })
      }

      if (path.startsWith('/drive/v3/files/') && method === 'PATCH') {
        const id = path.split('/').pop() as string
        const target = files.find((f) => f.id === id)
        if (!target) return jsonResponse({ error: 'not found' }, 404)
        const body = JSON.parse(init?.body as string)
        if (body.trashed) target.trashed = true
        save()
        return jsonResponse({ id: target.id, name: target.name, trashed: target.trashed })
      }

      if (path.startsWith('/drive/v3/files/')) {
        const id = path.split('/').pop() as string
        const target = files.find((f) => f.id === id)
        if (!target) return jsonResponse({ error: 'not found' }, 404)
        return new Response(fromBase64(target.base64), {
          headers: { 'Content-Type': target.mimeType },
        })
      }

      if (path === '/drive/v3/files' && method === 'GET') {
        const q = new URL(url).searchParams.get('q') ?? ''
        const found = files.filter((f) => matches(f, q))
        return jsonResponse({ files: found.map(publicView) })
      }

      return jsonResponse({ error: 'unexpected drive call: ' + method + ' ' + path }, 500)
    }
  })
}
