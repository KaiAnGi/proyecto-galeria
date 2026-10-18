const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

export interface UploadedFile {
  id: string
  name: string
  mimeType?: string
  modifiedTime?: string
}

export async function uploadBlob(
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
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  })
  if (!res.ok) throw new Error('Upload error: ' + res.status)
  return res.json()
}

export async function uploadJson(
  token: string,
  data: unknown,
  name: string,
  parents: string[],
  appProps?: Record<string, string>,
): Promise<UploadedFile> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const metadata = {
    name,
    parents,
    appProperties: appProps,
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob, name)
  const url = DRIVE_UPLOAD + '/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,appProperties'
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  })
  if (!res.ok) throw new Error('Upload error: ' + res.status)
  return res.json()
}

export async function findFileByName(
  token: string,
  name: string,
  parentId: string,
): Promise<UploadedFile | null> {
  const q = encodeURIComponent(`name='${name}' and trashed=false and '${parentId}' in parents`)
  const url = DRIVE_API + '/files?q=' + q + '&fields=files(id,name,mimeType,modifiedTime)'
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  if (!res.ok) throw new Error('Drive API error: ' + res.status)
  const data = await res.json()
  return (data.files || [])[0] || null
}

export async function listJsonFiles(token: string, parentId: string): Promise<UploadedFile[]> {
  const q = encodeURIComponent(`'${parentId}' in parents and trashed=false and mimeType='application/json'`)
  const url = DRIVE_API + '/files?q=' + q + '&fields=files(id,name,mimeType,modifiedTime)&pageSize=1000'
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  if (!res.ok) throw new Error('Drive API error: ' + res.status)
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
  if (!res.ok) throw new Error('Update error: ' + res.status)
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
  if (!res.ok) throw new Error('Download error: ' + res.status)
  return await res.blob()
}

export async function trashFile(token: string, fileId: string): Promise<void> {
  const url = DRIVE_API + '/files/' + fileId
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  })
  if (!res.ok) throw new Error('Trash error: ' + res.status)
}
