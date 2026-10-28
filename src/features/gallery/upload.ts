import { ulid } from 'ulidx'
import { fileToBitmap, createMiniDataUrl, imageExtension, processImage } from '../../lib/image/imageProcessor'
import { classifyFile, getVideoThumbnail } from '../../lib/media/mediaProcessor'
import { uploadBlob, uploadJson } from '../drive/driveImageClient'
import type { Obra, Archivo } from './store'
import { useGalleryStore } from './store'
import { ensureToken } from '../auth/googleAuth'
import { findRootFolder, createFolder } from '../drive/driveClient'
import { assertDriveOk, onDriveAuthError } from '../drive/driveHttp'
import { mapWithConcurrency } from '../../lib/async/mapWithConcurrency'
import { computeOrigen } from './versions'

export async function ensureFolder(token: string, rootId: string, name: string, kind: string): Promise<string> {
  const q = encodeURIComponent(`name='${name}' and trashed=false and '${rootId}' in parents`)
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  assertDriveOk(res, 'Drive API error')
  const d = await res.json()
  const f = (d.files || [])[0]
  if (f?.id) return f.id
  const created = await createFolder(token, name, [rootId], { kind, rootId })
  return created.id
}

export interface FolderIds {
  rootId: string
  archivosId: string
  originalesId: string
  galeriaId: string
  miniaturasId: string
  datosId: string
  obrasId: string
  coleccionesId: string
  secuenciasId: string
  entregasId: string
}

let cachedFolders: FolderIds | null = null
let folderPromise: Promise<FolderIds> | null = null

export function clearFolderCache(): void {
  cachedFolders = null
  folderPromise = null
}

onDriveAuthError(clearFolderCache)

async function loadFolderIds(token: string): Promise<FolderIds> {
  const root = await findRootFolder(token)
  if (!root) throw new Error('Raíz no encontrada')

  const [archivosId, datosId] = await Promise.all([
    ensureFolder(token, root.id, 'archivos', 'archivos'),
    ensureFolder(token, root.id, '_datos', 'datos'),
  ])

  const [originalesId, galeriaId, miniaturasId, obrasId, coleccionesId, secuenciasId, entregasId] = await Promise.all([
    ensureFolder(token, archivosId, 'originales', 'originales'),
    ensureFolder(token, archivosId, 'galeria', 'galeria'),
    ensureFolder(token, archivosId, 'miniaturas', 'miniaturas'),
    ensureFolder(token, datosId, 'obras', 'obras'),
    ensureFolder(token, datosId, 'colecciones', 'colecciones'),
    ensureFolder(token, datosId, 'secuencias', 'secuencias'),
    ensureFolder(token, datosId, 'entregas', 'entregas'),
  ])

  return {
    rootId: root.id,
    archivosId,
    originalesId,
    galeriaId,
    miniaturasId,
    datosId,
    obrasId,
    coleccionesId,
    secuenciasId,
    entregasId,
  }
}

export async function getFolderIds(token: string): Promise<FolderIds> {
  if (cachedFolders) return cachedFolders
  if (folderPromise) return folderPromise

  folderPromise = loadFolderIds(token)
    .then((folders) => {
      cachedFolders = folders
      return folders
    })
    .finally(() => {
      folderPromise = null
    })

  return folderPromise
}

const UPLOAD_CONCURRENCY = 2

async function uploadDrawing(file: File, folders: FolderIds): Promise<Obra> {
  const token = await ensureToken()
  const now = new Date()
  const isoDate = now.toISOString()
  const id = ulid()
  const kind = classifyFile(file)

  let archivo: Archivo
  let miniatura = ''

  if (kind === 'video') {
    const [upOrig, thumbnail] = await Promise.all([
      uploadBlob(token, file, `${id}-original`, [folders.originalesId], { kind: 'original', obraId: id }),
      getVideoThumbnail(file).catch(() => ''),
    ])
    miniatura = thumbnail
    if (miniatura) {
      const miniBlob = await (await fetch(miniatura)).blob()
      await uploadBlob(token, miniBlob, `${id}-mini.jpg`, [folders.miniaturasId], { kind: 'miniatura', obraId: id })
    }
    archivo = {
      id: ulid(),
      tipo: 'video',
      rol: 'proceso',
      orden: 0,
      mime: file.type || 'video/mp4',
      bytes: file.size,
      tomadaEn: isoDate,
      drive: { originalId: upOrig.id },
    }
  } else if (kind === 'gif') {
    const bmp = await fileToBitmap(file)
    let width: number
    let height: number
    try {
      width = bmp.width
      height = bmp.height
      miniatura = await createMiniDataUrl(bmp, 480, 0.8)
    } finally {
      bmp.close()
    }

    const miniBlob = await (await fetch(miniatura)).blob()
    const [upOrig] = await Promise.all([
      uploadBlob(token, file, `${id}-original`, [folders.originalesId], { kind: 'original', obraId: id }),
      uploadBlob(token, miniBlob, `${id}-mini.${imageExtension(miniBlob)}`, [folders.miniaturasId], {
        kind: 'miniatura',
        obraId: id,
      }),
    ])
    archivo = {
      id: ulid(),
      tipo: 'gif',
      rol: 'digital',
      orden: 0,
      mime: 'image/gif',
      ancho: width,
      alto: height,
      bytes: file.size,
      tomadaEn: isoDate,
      drive: { originalId: upOrig.id, galeriaId: upOrig.id },
    }
  } else {
    const bmp = await fileToBitmap(file)
    let processed
    try {
      processed = await processImage(bmp)
    } finally {
      bmp.close()
    }

    miniatura = processed.miniDataUrl
    const galeriaName = `${id}.${imageExtension(processed.galleryBlob)}`
    const miniName = `${id}-mini.${imageExtension(processed.miniBlob)}`
    const [upOrig, upGal] = await Promise.all([
      uploadBlob(token, file, `${id}-original`, [folders.originalesId], { kind: 'original', obraId: id }),
      uploadBlob(token, processed.galleryBlob, galeriaName, [folders.galeriaId], { kind: 'galeria', obraId: id }),
      uploadBlob(token, processed.miniBlob, miniName, [folders.miniaturasId], { kind: 'miniatura', obraId: id }),
    ])
    archivo = {
      id: ulid(),
      tipo: 'imagen',
      rol: 'tradicional',
      orden: 0,
      mime: processed.galleryBlob.type || 'image/webp',
      ancho: processed.width,
      alto: processed.height,
      bytes: file.size,
      tomadaEn: isoDate,
      drive: { originalId: upOrig.id, galeriaId: upGal.id },
    }
  }

  const obra: Obra = {
    schema: 1,
    id,
    rev: 1,
    creadaEn: isoDate,
    updatedAt: isoDate,
    titulo: 'Sin título',
    fecha: now.toISOString().slice(0, 10),
    estado: 'terminada',
    origen: kind === 'video' ? 'digital' : 'tradicional',
    tecnicas: [],
    tags: [],
    coleccionIds: [],
    miniatura,
    archivos: [archivo],
  }

  await uploadJson(token, obra, `obra-${id}.json`, [folders.obrasId], { kind: 'obra', id })
  useGalleryStore.getState().addObra(obra)
  return obra
}

export async function uploadDrawings(files: File[]): Promise<Obra[]> {
  const token = await ensureToken()
  const folders = await getFolderIds(token)
  return mapWithConcurrency(files, UPLOAD_CONCURRENCY, (file) => uploadDrawing(file, folders))
}

export async function uploadObraVersion(
  token: string,
  obra: Obra,
  file: File,
  rol: Archivo['rol'],
  etapa?: Archivo['etapa'],
): Promise<Obra> {
  const folders = await getFolderIds(token)
  const id = ulid()
  const isoDate = new Date().toISOString()
  const kind = classifyFile(file)

  let archivo: Archivo

  if (kind === 'gif') {
    const bmp = await fileToBitmap(file)
    let width: number
    let height: number
    let miniDataUrl: string
    try {
      width = bmp.width
      height = bmp.height
      miniDataUrl = await createMiniDataUrl(bmp, 480, 0.8)
    } finally {
      bmp.close()
    }

    const miniBlob = await (await fetch(miniDataUrl)).blob()
    const [upOrig] = await Promise.all([
      uploadBlob(token, file, `${id}-original`, [folders.originalesId], { kind: 'original', obraId: obra.id }),
      uploadBlob(token, miniBlob, `${id}-mini.${imageExtension(miniBlob)}`, [folders.miniaturasId], {
        kind: 'miniatura',
        obraId: obra.id,
      }),
    ])
    archivo = {
      id,
      tipo: 'gif',
      rol,
      etapa,
      orden: obra.archivos.length,
      mime: 'image/gif',
      ancho: width,
      alto: height,
      bytes: file.size,
      tomadaEn: isoDate,
      drive: { originalId: upOrig.id, galeriaId: upOrig.id },
    }
  } else {
    const bmp = await fileToBitmap(file)
    let processed
    try {
      processed = await processImage(bmp)
    } finally {
      bmp.close()
    }

    const galeriaName = `${id}.${imageExtension(processed.galleryBlob)}`
    const miniName = `${id}-mini.${imageExtension(processed.miniBlob)}`
    const [upOrig, upGal] = await Promise.all([
      uploadBlob(token, file, `${id}-original`, [folders.originalesId], { kind: 'original', obraId: obra.id }),
      uploadBlob(token, processed.galleryBlob, galeriaName, [folders.galeriaId], { kind: 'galeria', obraId: obra.id }),
      uploadBlob(token, processed.miniBlob, miniName, [folders.miniaturasId], { kind: 'miniatura', obraId: obra.id }),
    ])
    archivo = {
      id,
      tipo: 'imagen',
      rol,
      etapa,
      orden: obra.archivos.length,
      mime: processed.galleryBlob.type || 'image/webp',
      ancho: processed.width,
      alto: processed.height,
      bytes: file.size,
      tomadaEn: isoDate,
      drive: { originalId: upOrig.id, galeriaId: upGal.id },
    }
  }

  const archivos = [...obra.archivos, archivo]
  return { ...obra, archivos, origen: computeOrigen(archivos), updatedAt: isoDate }
}
