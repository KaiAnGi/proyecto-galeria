import { getFolderIds } from './upload'
import { upsertJson, listJsonFiles, downloadJson, trashFile, findFileByName } from '../drive/driveImageClient'
import {
  ensureColeccionFolder,
  syncObraIntoColeccionFolder,
  syncSecuenciaIntoColeccionFolder,
  trashColeccionFolder,
} from '../drive/collectionFolders'
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

export async function syncColeccionSecuencia(
  token: string,
  coleccion: Coleccion,
  secuencia: Secuencia,
  inside: boolean,
): Promise<void> {
  await syncSecuenciaIntoColeccionFolder(token, coleccion, secuencia, inside)
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
  await trashColeccionFolder(token, coleccion)
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

function isAuthError(e: unknown): boolean {
  return e instanceof Error && /(?:401|403)/.test(e.message)
}

async function loadEntities<T>(
  token: string,
  files: Array<{ id: string }>,
): Promise<T[]> {
  const results = await Promise.allSettled(files.map((file) => downloadJson<T>(token, file.id)))
  const items: T[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(result.value)
      continue
    }
    if (isAuthError(result.reason)) throw result.reason
  }
  return items
}

export async function loadAllData(token: string): Promise<LoadedData> {
  const folders = await getFolderIds(token)
  const folderResults = await Promise.allSettled([
    listJsonFiles(token, folders.obrasId),
    listJsonFiles(token, folders.coleccionesId),
    listJsonFiles(token, folders.secuenciasId),
    listJsonFiles(token, folders.entregasId),
  ])

  for (const result of folderResults) {
    if (result.status === 'rejected' && isAuthError(result.reason)) throw result.reason
  }

  const rejected = folderResults.filter((result) => result.status === 'rejected')
  if (rejected.length > 0) {
    console.warn(`${rejected.length} Drive folder(s) failed to load`, rejected[0].reason)
  }
  if (rejected.length === folderResults.length && rejected[0]?.status === 'rejected') {
    throw rejected[0].reason
  }

  const files = folderResults.map((result) => (result.status === 'fulfilled' ? result.value : []))
  const [obras, colecciones, secuencias, entregas] = await Promise.all([
    loadEntities<Obra>(token, files[0]),
    loadEntities<Coleccion>(token, files[1]),
    loadEntities<Secuencia>(token, files[2]),
    loadEntities<Entrega>(token, files[3]),
  ])

  return { obras, colecciones, secuencias, entregas }
}

let loadedOnce = false
let loadPromise: Promise<void> | null = null

export function isGalleryLoaded(): boolean {
  return loadedOnce
}

export function resetLoadedOnce(): void {
  loadedOnce = false
  loadPromise = null
}

export async function ensureLoaded(token: string): Promise<void> {
  if (loadedOnce) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const data = await loadAllData(token)
    useGalleryStore.getState().hydrate(data)
    loadedOnce = true
  })()

  try {
    await loadPromise
  } finally {
    loadPromise = null
  }
}
