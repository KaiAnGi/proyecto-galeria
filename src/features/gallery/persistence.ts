import { getFolderIds } from './upload'
import { upsertJson, listJsonFiles, downloadJson, trashFile, findFileByName } from '../drive/driveImageClient'
import { ensureColeccionFolder, syncObraIntoColeccionFolder } from '../drive/collectionFolders'
import type { Obra, Coleccion, Entrega } from './store'
import type { Secuencia } from './secuencias'
import { useGalleryStore } from './store'

export async function saveObra(token: string, obra: Obra): Promise<void> {
  const folders = await getFolderIds(token)
  await upsertJson(token, obra, `obra-${obra.id}.json`, [folders.obrasId], { kind: 'obra', id: obra.id })
}

export async function saveColeccion(token: string, coleccion: Coleccion): Promise<void> {
  const folders = await getFolderIds(token)
  const driveFolderId = coleccion.driveFolderId || (await ensureColeccionFolder(token, coleccion))
  const conFolder = driveFolderId === coleccion.driveFolderId ? coleccion : { ...coleccion, driveFolderId }
  await upsertJson(token, conFolder, `coleccion-${coleccion.id}.json`, [folders.coleccionesId], {
    kind: 'coleccion',
    id: coleccion.id,
  })
  if (driveFolderId !== coleccion.driveFolderId) {
    useGalleryStore.getState().updateColeccion(coleccion.id, { driveFolderId })
  }
}

export async function syncColeccionObra(
  token: string,
  coleccion: Coleccion,
  obra: Obra,
  inside: boolean,
): Promise<void> {
  await syncObraIntoColeccionFolder(token, coleccion, obra, inside)
}

export async function saveSecuencia(token: string, secuencia: Secuencia): Promise<void> {
  const folders = await getFolderIds(token)
  await upsertJson(token, secuencia, `secuencia-${secuencia.id}.json`, [folders.secuenciasId], {
    kind: 'secuencia',
    id: secuencia.id,
  })
}

export async function saveEntrega(token: string, entrega: Entrega): Promise<void> {
  const folders = await getFolderIds(token)
  await upsertJson(token, entrega, `entrega-${entrega.id}.json`, [folders.entregasId], {
    kind: 'entrega',
    id: entrega.id,
  })
}

async function trashJsonByName(token: string, folderId: string, name: string): Promise<void> {
  const file = await findFileByName(token, name, folderId)
  if (file) await trashFile(token, file.id)
}

export async function trashObra(token: string, obra: Obra): Promise<void> {
  const folders = await getFolderIds(token)
  const ids = obra.archivos.flatMap((a) =>
    [a.drive.originalId, a.drive.galeriaId, a.drive.miniaturaId].filter((x): x is string => Boolean(x)),
  )
  await Promise.allSettled(ids.map((fileId) => trashFile(token, fileId)))
  await trashJsonByName(token, folders.obrasId, `obra-${obra.id}.json`)
}

export async function trashColeccion(token: string, coleccion: Coleccion): Promise<void> {
  const folders = await getFolderIds(token)
  await trashJsonByName(token, folders.coleccionesId, `coleccion-${coleccion.id}.json`)
}

export async function trashSecuencia(token: string, secuencia: Secuencia): Promise<void> {
  const folders = await getFolderIds(token)
  await trashJsonByName(token, folders.secuenciasId, `secuencia-${secuencia.id}.json`)
}

export async function trashEntrega(token: string, entrega: Entrega): Promise<void> {
  const folders = await getFolderIds(token)
  await trashJsonByName(token, folders.entregasId, `entrega-${entrega.id}.json`)
}

export interface LoadedData {
  obras: Obra[]
  colecciones: Coleccion[]
  secuencias: Secuencia[]
  entregas: Entrega[]
}

export async function loadAllData(token: string): Promise<LoadedData> {
  const folders = await getFolderIds(token)
  const [obraFiles, coleccionFiles, secuenciaFiles, entregaFiles] = await Promise.all([
    listJsonFiles(token, folders.obrasId),
    listJsonFiles(token, folders.coleccionesId),
    listJsonFiles(token, folders.secuenciasId),
    listJsonFiles(token, folders.entregasId),
  ])
  const [obras, colecciones, secuencias, entregas] = await Promise.all([
    Promise.all(obraFiles.map((f) => downloadJson<Obra>(token, f.id))),
    Promise.all(coleccionFiles.map((f) => downloadJson<Coleccion>(token, f.id))),
    Promise.all(secuenciaFiles.map((f) => downloadJson<Secuencia>(token, f.id))),
    Promise.all(entregaFiles.map((f) => downloadJson<Entrega>(token, f.id))),
  ])
  return { obras, colecciones, secuencias, entregas }
}

let loadedOnce = false

export function resetLoadedOnce(): void {
  loadedOnce = false
}

export async function ensureLoaded(token: string): Promise<void> {
  if (loadedOnce) return
  loadedOnce = true
  try {
    const data = await loadAllData(token)
    useGalleryStore.getState().hydrate(data)
  } catch (e) {
    loadedOnce = false
    throw e
  }
}
