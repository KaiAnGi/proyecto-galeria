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
