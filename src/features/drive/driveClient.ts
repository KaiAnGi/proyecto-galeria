import { ulid } from 'ulidx'
import { assertDriveOk } from './driveHttp'

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'

export interface DriveFile {
  id: string
  name: string
  mimeType?: string
  modifiedTime?: string
  appProperties?: Record<string, string>
  parents?: string[]
}

export async function findRootFolder(token: string): Promise<DriveFile | null> {
  const q = encodeURIComponent('appProperties has { key=\'kind\' and value=\'root\' } and trashed=false')
  const url = DRIVE_API + '/files?q=' + q + '&spaces=drive&fields=files(id,name,mimeType,modifiedTime,appProperties,parents)'
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
  })
  assertDriveOk(res, 'Drive API error')
  const data = await res.json()
  const files = data.files || []
  return files[0] || null
}

export async function createFolder(
  token: string,
  name: string,
  parents?: string[],
  appProps?: Record<string, string>,
): Promise<DriveFile> {
  const body = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents,
    appProperties: appProps,
  }
  const url = DRIVE_API + '/files?fields=id,name,mimeType,appProperties,parents'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  assertDriveOk(res, 'Drive API error')
  return res.json()
}

export async function findOrCreateAppRootFolder(token: string): Promise<DriveFile> {
  const existing = await findRootFolder(token)
  if (existing) return existing
  const rootId = ulid()
  const createdRoot = await createFolder(token, 'Kuromi likes your drawings', undefined, { kind: 'root', id: rootId })
  return createdRoot
}

export async function findFolderByName(token: string, name: string, parentId: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name='${name}' and trashed=false and '${parentId}' in parents`)
  const url = DRIVE_API + '/files?q=' + q + '&spaces=drive&fields=files(id,name,mimeType,appProperties,parents)'
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  assertDriveOk(res, 'Drive API error')
  const data = await res.json()
  const files = data.files || []
  return files[0] || null
}

export async function ensureFolder(token: string, name: string, parentId: string, kind: string): Promise<DriveFile> {
  const existing = await findFolderByName(token, name, parentId)
  if (existing) return existing
  return createFolder(token, name, [parentId], { kind, rootId: parentId })
}

export async function initDriveStructure(token: string): Promise<string> {
  const root = await findRootFolder(token)
  if (!root) {
    const rootId = ulid()
    const createdRoot = await createFolder(token, 'Mis obras', undefined, { kind: 'root', id: rootId })
    const datos = await createFolder(token, '_datos', [createdRoot.id], { kind: 'datos', rootId })
    await createFolder(token, 'obras', [datos.id], { kind: 'obras', rootId })
    await createFolder(token, 'colecciones', [datos.id], { kind: 'colecciones', rootId })
    await createFolder(token, 'secuencias', [datos.id], { kind: 'secuencias', rootId })
    await createFolder(token, 'entregas', [datos.id], { kind: 'entregas', rootId })
    const archivos = await createFolder(token, 'archivos', [createdRoot.id], { kind: 'archivos', rootId })
    await createFolder(token, 'originales', [archivos.id], { kind: 'originales', rootId })
    await createFolder(token, 'galeria', [archivos.id], { kind: 'galeria', rootId })
    await createFolder(token, 'miniaturas', [archivos.id], { kind: 'miniaturas', rootId })
    return createdRoot.id
  }
  return root.id
}

export async function saveTestFile(token: string): Promise<any> {
  const root = await findRootFolder(token)
  if (!root) throw new Error('Raíz no encontrada')
  let datosFolder: DriveFile | null = null
  const q = encodeURIComponent("name='_datos' and trashed=false and '" + root.id + "' in parents")
  const url = DRIVE_API + '/files?q=' + q + '&fields=files(id,name)'
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  if (res.ok) {
    const d = await res.json()
    datosFolder = (d.files || [])[0] || null
  }
  if (!datosFolder) {
    datosFolder = await createFolder(token, '_datos', [root.id], { kind: 'datos' })
  }
  const content = { schema: 1, rev: 1, updatedAt: new Date().toISOString(), test: true, message: 'Hola desde Mi Galería' }
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
  const metadata = { name: 'config.json', parents: [datosFolder.id], appProperties: { kind: 'config' } }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob)
  const uploadUrl = DRIVE_UPLOAD + '/files?uploadType=multipart&fields=id,name,modifiedTime,appProperties'
  const up = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form })
  assertDriveOk(up, 'Upload error')
  return up.json()
}

export async function loadTestFile(token: string): Promise<any> {
  const root = await findRootFolder(token)
  if (!root) throw new Error('Raíz no encontrada')
  const q = encodeURIComponent("name='config.json' and trashed=false")
  const url = DRIVE_API + '/files?q=' + q + '&fields=files(id,name)'
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  assertDriveOk(res, 'Drive API error')
  const d = await res.json()
  const f = (d.files || [])[0]
  if (!f) throw new Error('Archivo de prueba no encontrado')
  const dl = await fetch(DRIVE_API + '/files/' + f.id + '?alt=media', { headers: { Authorization: 'Bearer ' + token } })
  assertDriveOk(dl, 'Download error')
  return dl.json()
}
