import { ulid } from 'ulidx'
import { assertDriveOk } from './driveHttp'

const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'

export const ROOT_FOLDER_NAME = 'Kuromi Likes Your Drawings'
export const INTERNAL_FOLDER_NAME = '_interno'
export const INBOX_FOLDER_NAME = 'Sin colección'
const LEGACY_INTERNAL_FOLDER_NAME = '_datos'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

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

async function renameFile(token: string, fileId: string, name: string): Promise<void> {
  const url = DRIVE_API + '/files/' + fileId + '?fields=id,name'
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  assertDriveOk(res, 'Drive API error')
}

export async function ensureAppRootFolder(token: string): Promise<DriveFile> {
  const existing = await findRootFolder(token)
  if (existing) {
    if (existing.name !== ROOT_FOLDER_NAME) {
      await renameFile(token, existing.id, ROOT_FOLDER_NAME)
      return { ...existing, name: ROOT_FOLDER_NAME }
    }
    return existing
  }
  const rootId = ulid()
  return createFolder(token, ROOT_FOLDER_NAME, undefined, { kind: 'root', id: rootId })
}

export async function findOrCreateAppRootFolder(token: string): Promise<DriveFile> {
  return ensureAppRootFolder(token)
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
  if (existing?.mimeType === FOLDER_MIME) return existing
  return createFolder(token, name, [parentId], { kind, rootId: parentId })
}

async function moveFile(token: string, fileId: string, fromParentId: string, toParentId: string): Promise<void> {
  const url =
    DRIVE_API +
    '/files/' +
    fileId +
    '?addParents=' +
    toParentId +
    '&removeParents=' +
    fromParentId +
    '&fields=id,parents'
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assertDriveOk(res, 'Drive API error')
}

async function ensureInternalFolder(token: string, rootId: string): Promise<DriveFile> {
  const existing = await findFolderByName(token, INTERNAL_FOLDER_NAME, rootId)
  if (existing?.mimeType === FOLDER_MIME) return existing

  const legacy = await findFolderByName(token, LEGACY_INTERNAL_FOLDER_NAME, rootId)
  if (legacy?.mimeType === FOLDER_MIME) {
    await renameFile(token, legacy.id, INTERNAL_FOLDER_NAME)
    return { ...legacy, name: INTERNAL_FOLDER_NAME }
  }

  return createFolder(token, INTERNAL_FOLDER_NAME, [rootId], { kind: 'datos', rootId })
}

async function ensureArchivosFolder(token: string, internoId: string, rootId: string): Promise<DriveFile> {
  const existing = await findFolderByName(token, 'archivos', internoId)
  if (existing?.mimeType === FOLDER_MIME) return existing

  const legacy = await findFolderByName(token, 'archivos', rootId)
  if (legacy?.mimeType === FOLDER_MIME) {
    await moveFile(token, legacy.id, rootId, internoId)
    return legacy
  }

  return createFolder(token, 'archivos', [internoId], { kind: 'archivos', rootId: internoId })
}

export interface DriveStructure {
  rootId: string
  internoId: string
  archivosId: string
  originalesId: string
  galeriaId: string
  miniaturasId: string
  obrasId: string
  coleccionesId: string
  secuenciasId: string
  entregasId: string
  inboxId: string
}

export async function ensureDriveStructure(token: string): Promise<DriveStructure> {
  const root = await ensureAppRootFolder(token)
  const [interno, inbox] = await Promise.all([
    ensureInternalFolder(token, root.id),
    ensureFolder(token, INBOX_FOLDER_NAME, root.id, 'inbox'),
  ])
  const [archivos, obras, colecciones, secuencias, entregas] = await Promise.all([
    ensureArchivosFolder(token, interno.id, root.id),
    ensureFolder(token, 'obras', interno.id, 'obras'),
    ensureFolder(token, 'colecciones', interno.id, 'colecciones'),
    ensureFolder(token, 'secuencias', interno.id, 'secuencias'),
    ensureFolder(token, 'entregas', interno.id, 'entregas'),
  ])
  const [originales, galeria, miniaturas] = await Promise.all([
    ensureFolder(token, 'originales', archivos.id, 'originales'),
    ensureFolder(token, 'galeria', archivos.id, 'galeria'),
    ensureFolder(token, 'miniaturas', archivos.id, 'miniaturas'),
  ])
  return {
    rootId: root.id,
    internoId: interno.id,
    archivosId: archivos.id,
    originalesId: originales.id,
    galeriaId: galeria.id,
    miniaturasId: miniaturas.id,
    obrasId: obras.id,
    coleccionesId: colecciones.id,
    secuenciasId: secuencias.id,
    entregasId: entregas.id,
    inboxId: inbox.id,
  }
}

export async function initDriveStructure(token: string): Promise<string> {
  return (await ensureDriveStructure(token)).rootId
}

export async function saveTestFile(token: string): Promise<any> {
  const structure = await ensureDriveStructure(token)
  const content = { schema: 1, rev: 1, updatedAt: new Date().toISOString(), test: true, message: 'Hola desde Mi Galería' }
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
  const metadata = { name: 'config.json', parents: [structure.internoId], appProperties: { kind: 'config' } }
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
