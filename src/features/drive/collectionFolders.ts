import {
  createFolder,
  ensureAppRootFolder,
  ensureFolder,
  findFolderByName,
  INBOX_FOLDER_NAME,
} from './driveClient'
import { DRIVE_API, trashFile } from './driveImageClient'
import type { Coleccion, Obra } from '../gallery/store'
import type { Secuencia } from '../gallery/secuencias'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function getRootFolderId(token: string): Promise<string> {
  const cached = sessionStorage.getItem('gallery-root-id')
  if (cached) return cached
  const root = await ensureAppRootFolder(token)
  sessionStorage.setItem('gallery-root-id', root.id)
  return root.id
}

export async function getInboxFolderId(token: string): Promise<string> {
  const rootId = await getRootFolderId(token)
  const folder = await ensureFolder(token, INBOX_FOLDER_NAME, rootId, 'inbox')
  return folder.id
}

export async function ensureColeccionFolder(token: string, coleccion: Coleccion): Promise<string> {
  if (coleccion.driveFolderId) return coleccion.driveFolderId

  const parentId = await getRootFolderId(token)
  const existing = await findFolderByName(token, coleccion.nombre, parentId)
  if (existing?.mimeType === FOLDER_MIME && existing.appProperties?.id === coleccion.id) {
    return existing.id
  }
  const name = existing ? `${coleccion.nombre} (${coleccion.id.slice(-4)})` : coleccion.nombre
  const created = await createFolder(token, name, [parentId], { kind: 'coleccion', id: coleccion.id })
  return created.id
}

export async function trashColeccionFolder(token: string, coleccion: Coleccion): Promise<void> {
  if (coleccion.driveFolderId) {
    await trashFile(token, coleccion.driveFolderId)
    return
  }

  const rootId = await getRootFolderId(token)
  const folder = await findFolderByName(token, coleccion.nombre, rootId)
  if (folder?.mimeType === FOLDER_MIME && folder.appProperties?.id === coleccion.id) {
    await trashFile(token, folder.id)
  }
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

export function obraMainFileId(obra: Obra): string | null {
  const primary = obra.archivos[0]
  if (!primary) return null
  return primary.drive.galeriaId || primary.drive.originalId || null
}

export function secuenciaFileIds(secuencia: Secuencia): string[] {
  return secuencia.frames
    .flatMap((frame) => [frame.drive.originalId, frame.drive.galeriaId])
    .filter((x): x is string => Boolean(x))
}

export function secuenciaMainFileId(secuencia: Secuencia): string | null {
  if (secuencia.mainFileId) return secuencia.mainFileId
  const first = secuencia.frames[0]
  return first?.drive.galeriaId || first?.drive.originalId || null
}

export async function syncObraIntoColeccionFolder(
  token: string,
  coleccion: Coleccion,
  obra: Obra,
  shouldBeInside: boolean,
): Promise<void> {
  const fileId = obraMainFileId(obra)
  if (!fileId) return

  const folderId = coleccion.driveFolderId || (await ensureColeccionFolder(token, coleccion))
  if (shouldBeInside) {
    await addFilesToFolder(token, [fileId], folderId)
    const inboxId = await getInboxFolderId(token)
    await removeFilesFromFolder(token, [fileId], inboxId)
    return
  }

  await removeFilesFromFolder(token, [fileId], folderId)
  if (obra.coleccionIds.length === 0) {
    const inboxId = await getInboxFolderId(token)
    await addFilesToFolder(token, [fileId], inboxId)
  }
}

export async function syncSecuenciaIntoColeccionFolder(
  token: string,
  coleccion: Coleccion,
  secuencia: Secuencia,
  shouldBeInside: boolean,
): Promise<void> {
  const fileId = secuenciaMainFileId(secuencia)
  if (!fileId) return

  const folderId = coleccion.driveFolderId || (await ensureColeccionFolder(token, coleccion))
  if (shouldBeInside) {
    await addFilesToFolder(token, [fileId], folderId)
    const inboxId = await getInboxFolderId(token)
    await removeFilesFromFolder(token, [fileId], inboxId)
    return
  }

  await removeFilesFromFolder(token, [fileId], folderId)
  if ((secuencia.coleccionIds ?? []).length === 0) {
    const inboxId = await getInboxFolderId(token)
    await addFilesToFolder(token, [fileId], inboxId)
  }
}

export async function listFolderChildren(token: string, folderId: string): Promise<{ id: string; name: string; isFolder: boolean }[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`)
  const url = DRIVE_API + '/files?q=' + q + '&fields=files(id,name,mimeType)&pageSize=1000'
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  if (!res.ok) throw new Error('Drive API error: ' + res.status)
  const data = await res.json()
  return (data.files || []).map((f: any) => ({ id: f.id, name: f.name, isFolder: f.mimeType === FOLDER_MIME }))
}
