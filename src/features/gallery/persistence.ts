import { getFolderIds } from './upload'
import { upsertJson, listJsonFiles, downloadJson, trashFile, findFileByName } from '../drive/driveImageClient'
import type { Obra, Coleccion } from './store'
import type { Secuencia } from './secuencias'
import { useGalleryStore } from './store'

export async function saveObra(token: string, obra: Obra): Promise<void> {
  const folders = await getFolderIds(token)
  await upsertJson(token, obra, `obra-${obra.id}.json`, [folders.obrasId], { kind: 'obra', id: obra.id })
}

export async function saveColeccion(token: string, coleccion: Coleccion): Promise<void> {
  const folders = await getFolderIds(token)
  await upsertJson(token, coleccion, `coleccion-${coleccion.id}.json`, [folders.coleccionesId], {
    kind: 'coleccion',
    id: coleccion.id,
  })
}

export async function saveSecuencia(token: string, secuencia: Secuencia): Promise<void> {
  const folders = await getFolderIds(token)
  await upsertJson(token, secuencia, `secuencia-${secuencia.id}.json`, [folders.secuenciasId], {
    kind: 'secuencia',
    id: secuencia.id,
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

export interface LoadedData {
  obras: Obra[]
  colecciones: Coleccion[]
  secuencias: Secuencia[]
}

export async function loadAllData(token: string): Promise<LoadedData> {
  const folders = await getFolderIds(token)
  const [obraFiles, coleccionFiles, secuenciaFiles] = await Promise.all([
    listJsonFiles(token, folders.obrasId),
    listJsonFiles(token, folders.coleccionesId),
    listJsonFiles(token, folders.secuenciasId),
  ])
  const [obras, colecciones, secuencias] = await Promise.all([
    Promise.all(obraFiles.map((f) => downloadJson<Obra>(token, f.id))),
    Promise.all(coleccionFiles.map((f) => downloadJson<Coleccion>(token, f.id))),
    Promise.all(secuenciaFiles.map((f) => downloadJson<Secuencia>(token, f.id))),
  ])
  return { obras, colecciones, secuencias }
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
