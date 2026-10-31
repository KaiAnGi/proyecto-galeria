import { assertDriveOk, reportDriveAuthErrorIfNeeded } from './driveHttp'

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
export const DRIVE_API = 'https://www.googleapis.com/drive/v3'

export interface UploadedFile {
  id: string
  name: string
  mimeType?: string
  modifiedTime?: string
}

const MAX_UPLOAD_ATTEMPTS = 3
const RETRY_BASE_MS = 400

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isRateLimitResponse(res: Response): Promise<boolean> {
  if (res.status === 429) return true
  if (res.status !== 403) return false
  try {
    const body = await res.clone().text()
    return /rateLimitExceeded|userRateLimitExceeded/i.test(body)
  } catch {
    return false
  }
}

async function uploadMultipart(
  token: string,
  blob: Blob,
  name: string,
  parents: string[],
  appProps?: Record<string, string>,
): Promise<UploadedFile> {
  const metadata = {
    name,
    parents,
    appProperties: appProps,
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob, name)
  const url = DRIVE_UPLOAD + '/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,appProperties'

  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: form,
    })
    if (res.ok) return res.json()
    if (attempt < MAX_UPLOAD_ATTEMPTS - 1 && (await isRateLimitResponse(res))) {
      const retryAfter = Number(res.headers.get('Retry-After'))
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_BASE_MS * 2 ** attempt
      await wait(delay)
      continue
    }
    reportDriveAuthErrorIfNeeded(res)
    throw new Error('Upload error: ' + res.status)
  }

  throw new Error('Upload error: too many attempts')
}

export function uploadBlob(
  token: string,
  blob: Blob,
  name: string,
  parents: string[],
  appProps?: Record<string, string>,
): Promise<UploadedFile> {
  return uploadMultipart(token, blob, name, parents, appProps)
}

export function uploadJson(
  token: string,
  data: unknown,
  name: string,
  parents: string[],
  appProps?: Record<string, string>,
): Promise<UploadedFile> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  return uploadMultipart(token, blob, name, parents, appProps)
}

export async function updateBlob(token: string, fileId: string, blob: Blob): Promise<UploadedFile> {
  const url = DRIVE_UPLOAD + '/files/' + fileId + '?uploadType=media&fields=id,name,mimeType,modifiedTime'
  const contentType = blob.type || 'application/octet-stream'

  for (let attempt = 0; attempt < MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': contentType },
      body: blob,
    })
    if (res.ok) return res.json()
    if (attempt < MAX_UPLOAD_ATTEMPTS - 1 && (await isRateLimitResponse(res))) {
      const retryAfter = Number(res.headers.get('Retry-After'))
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_BASE_MS * 2 ** attempt
      await wait(delay)
      continue
    }
    reportDriveAuthErrorIfNeeded(res)
    throw new Error('Update error: ' + res.status)
  }

  throw new Error('Update error: too many attempts')
}

export async function findFileByName(
  token: string,
  name: string,
  parentId: string,
): Promise<UploadedFile | null> {
  const q = encodeURIComponent(`name='${name}' and trashed=false and '${parentId}' in parents`)
  const url = DRIVE_API + '/files?q=' + q + '&fields=files(id,name,mimeType,modifiedTime)'
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  assertDriveOk(res, 'Drive API error')
  const data = await res.json()
  return (data.files || [])[0] || null
}

export async function listJsonFiles(token: string, parentId: string): Promise<UploadedFile[]> {
  const q = encodeURIComponent(`'${parentId}' in parents and trashed=false and mimeType='application/json'`)
  const url = DRIVE_API + '/files?q=' + q + '&fields=files(id,name,mimeType,modifiedTime)&pageSize=1000'
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  assertDriveOk(res, 'Drive API error')
  const data = await res.json()
  return data.files || []
}

export async function updateJson(token: string, fileId: string, data: unknown): Promise<UploadedFile> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = DRIVE_UPLOAD + '/files/' + fileId + '?uploadType=media&fields=id,name,mimeType,modifiedTime'
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: blob,
  })
  assertDriveOk(res, 'Update error')
  return res.json()
}

export async function upsertJson(
  token: string,
  data: unknown,
  name: string,
  parents: string[],
  appProps?: Record<string, string>,
): Promise<UploadedFile> {
  const existing = await findFileByName(token, name, parents[0])
  if (existing) return updateJson(token, existing.id, data)
  return uploadJson(token, data, name, parents, appProps)
}

export async function downloadJson<T>(token: string, fileId: string): Promise<T> {
  const blob = await downloadFileAsBlob(token, fileId)
  return JSON.parse(await blob.text()) as T
}

export async function downloadFileAsBlob(token: string, fileId: string, _mimeHint?: string): Promise<Blob> {
  const url = DRIVE_API + '/files/' + fileId + '?alt=media'
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    cache: 'no-store',
  })
  assertDriveOk(res, 'Download error')
  return await res.blob()
}

export async function trashFile(token: string, fileId: string): Promise<void> {
  const url = DRIVE_API + '/files/' + fileId
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  })
  assertDriveOk(res, 'Trash error')
}
