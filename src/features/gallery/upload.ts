import { ulid } from 'ulidx'
import { fileToBitmap, createMiniDataUrl, imageExtension, processImage } from '../../lib/image/imageProcessor'
import { classifyFile, getVideoThumbnail } from '../../lib/media/mediaProcessor'
import { uploadBlob, uploadJson } from '../drive/driveImageClient'
import { addFilesToFolder } from '../drive/collectionFolders'
import type { Obra, Archivo } from './store'
import { useGalleryStore } from './store'
import { ensureToken } from '../auth/googleAuth'
import { ensureDriveStructure } from '../drive/driveClient'
import { onDriveAuthError } from '../drive/driveHttp'
import { mapWithConcurrency } from '../../lib/async/mapWithConcurrency'
import { computeOrigen } from './versions'

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
  inboxId: string
}

let cachedFolders: FolderIds | null = null
let folderPromise: Promise<FolderIds> | null = null

export function clearFolderCache(): void {
  cachedFolders = null
  folderPromise = null
}

onDriveAuthError(clearFolderCache)

async function loadFolderIds(token: string): Promise<FolderIds> {
  const structure = await ensureDriveStructure(token)
  return {
    rootId: structure.rootId,
    archivosId: structure.archivosId,
    originalesId: structure.originalesId,
    galeriaId: structure.galeriaId,
    miniaturasId: structure.miniaturasId,
    datosId: structure.internoId,
    obrasId: structure.obrasId,
    coleccionesId: structure.coleccionesId,
    secuenciasId: structure.secuenciasId,
    entregasId: structure.entregasId,
    inboxId: structure.inboxId,
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

function mainFileBase(id: string): string {
  return `Sin título [${id.slice(-6)}]`
}

function videoExtension(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase()
  return ext && /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'mp4'
}

async function uploadDrawing(file: File, folders: FolderIds): Promise<Obra> {
  const token = await ensureToken()
  const now = new Date()
  const isoDate = now.toISOString()
  const id = ulid()
  const kind = classifyFile(file)
  const base = mainFileBase(id)

  let archivo: Archivo
  let miniatura = ''
  let mainFileId = ''

  if (kind === 'video') {
    const [upOrig, thumbnail] = await Promise.all([
      uploadBlob(token, file, `${base}.${videoExtension(file)}`, [folders.originalesId], {
        kind: 'original',
        obraId: id,
      }),
      getVideoThumbnail(file).catch(() => ''),
    ])
    mainFileId = upOrig.id
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
      uploadBlob(token, file, `${base}.gif`, [folders.originalesId], { kind: 'original', obraId: id }),
      uploadBlob(token, miniBlob, `${id}-mini.${imageExtension(miniBlob)}`, [folders.miniaturasId], {
        kind: 'miniatura',
        obraId: id,
      }),
    ])
    mainFileId = upOrig.id
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
    const galeriaName = `${base}.${imageExtension(processed.galleryBlob)}`
    const miniName = `${id}-mini.${imageExtension(processed.miniBlob)}`
    const [upOrig, upGal] = await Promise.all([
      uploadBlob(token, file, `${id}-original`, [folders.originalesId], { kind: 'original', obraId: id }),
      uploadBlob(token, processed.galleryBlob, galeriaName, [folders.galeriaId], { kind: 'galeria', obraId: id }),
      uploadBlob(token, processed.miniBlob, miniName, [folders.miniaturasId], { kind: 'miniatura', obraId: id }),
    ])
    mainFileId = upGal.id
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

  await addFilesToFolder(token, [mainFileId], folders.inboxId)
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
