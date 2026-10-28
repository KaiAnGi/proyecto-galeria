import { createFolder, ensureFolder, findFolderByName, findRootFolder } from './driveClient'
import { DRIVE_API, trashFile } from './driveImageClient'
import type { Coleccion, Obra } from '../gallery/store'
import type { Secuencia } from '../gallery/secuencias'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function getRootFolderId(token: string): Promise<string> {
  const cached = sessionStorage.getItem('gallery-root-id')
  if (cached) return cached
  const root = await findRootFolder(token)
  if (!root) throw new Error('Raíz no encontrada')
  sessionStorage.setItem('gallery-root-id', root.id)
  return root.id
}

export async function getColeccionesFolderId(token: string): Promise<string> {
  const rootId = await getRootFolderId(token)
  const folder = await ensureFolder(token, 'Colecciones', rootId, 'colecciones-folder')
  return folder.id
}

export async function ensureColeccionFolder(token: string, coleccion: Coleccion): Promise<string> {
  const parentId = await getColeccionesFolderId(token)
  const existing = await findFolderByName(token, coleccion.nombre, parentId)
  if (existing) {
    if (existing.appProperties?.id !== coleccion.id) {
      await setFileAppProperties(token, existing.id, { kind: 'coleccion', id: coleccion.id })
    }
    return existing.id
  }
  const created = await createFolder(token, coleccion.nombre, [parentId], { kind: 'coleccion', id: coleccion.id })
  return created.id
}

async function setFileAppProperties(token: string, fileId: string, appProps: Record<string, string>): Promise<void> {
  const url = DRIVE_API + '/files/' + fileId + '?fields=id,appProperties'
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ appProperties: appProps }),
  })
  if (!res.ok) throw new Error('Drive API error: ' + res.status)
}

export async function trashColeccionFolder(token: string, coleccion: Coleccion): Promise<void> {
  if (coleccion.driveFolderId) {
    await trashFile(token, coleccion.driveFolderId)
    return
  }

  const rootId = await getRootFolderId(token)
  const coleccionesFolder = await findFolderByName(token, 'Colecciones', rootId)
  if (!coleccionesFolder) return
  const folder = await findFolderByName(token, coleccion.nombre, coleccionesFolder.id)
  if (folder?.appProperties?.id === coleccion.id) await trashFile(token, folder.id)
}

export async function addFilesToFolder(token: string, fileIds: string[], folderId: string): Promise<void> {
  for (const fileId of fileIds) {
    const url = DRIVE_API + '/files/' + fileId + '?addParents=' + folderId + '&fields=id,parents'
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error('Drive API error: ' + res.status)
  }
}

export async function removeFilesFromFolder(token: string, fileIds: string[], folderId: string): Promise<void> {
  for (const fileId of fileIds) {
    const url = DRIVE_API + '/files/' + fileId + '?removeParents=' + folderId + '&fields=id,parents'
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    if (!res.ok) throw new Error('Drive API error: ' + res.status)
  }
}

export function obraFileIds(obra: Obra): string[] {
  return obra.archivos
    .flatMap((a) => [a.drive.originalId, a.drive.galeriaId, a.drive.miniaturaId])
    .filter((x): x is string => Boolean(x))
}

export async function syncObraIntoColeccionFolder(
  token: string,
  coleccion: Coleccion,
  obra: Obra,
  shouldBeInside: boolean,
): Promise<void> {
  const folderId = coleccion.driveFolderId || (await ensureColeccionFolder(token, coleccion))
  const ids = obraFileIds(obra)
  if (shouldBeInside) await addFilesToFolder(token, ids, folderId)
  else await removeFilesFromFolder(token, ids, folderId)
}

export function secuenciaFileIds(secuencia: Secuencia): string[] {
  return secuencia.frames
    .flatMap((frame) => [frame.drive.originalId, frame.drive.galeriaId])
    .filter((x): x is string => Boolean(x))
}

export async function syncSecuenciaIntoColeccionFolder(
  token: string,
  coleccion: Coleccion,
  secuencia: Secuencia,
  shouldBeInside: boolean,
): Promise<void> {
  const folderId = coleccion.driveFolderId || (await ensureColeccionFolder(token, coleccion))
  const ids = secuenciaFileIds(secuencia)
  if (shouldBeInside) await addFilesToFolder(token, ids, folderId)
  else await removeFilesFromFolder(token, ids, folderId)
}

export async function listFolderChildren(token: string, folderId: string): Promise<{ id: string; name: string; isFolder: boolean }[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
  const url = DRIVE_API + '/files?q=' + q + '&fields=files(id,name,mimeType)&pageSize=1000'
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  if (!res.ok) throw new Error('Drive API error: ' + res.status)
  const data = await res.json()
  return (data.files || []).map((f: any) => ({ id: f.id, name: f.name, isFolder: f.mimeType === FOLDER_MIME }))
}
