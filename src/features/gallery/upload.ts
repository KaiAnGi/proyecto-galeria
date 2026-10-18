import { ulid } from 'ulidx'
import { fileToBitmap, resizeToMaxDimensions, createMiniDataUrl, determineMime } from '../../lib/image/imageProcessor'
import { uploadBlob, uploadJson } from '../drive/driveImageClient'
import type { Obra, Archivo } from './store'
import { useGalleryStore } from './store'
import { getToken } from '../auth/googleAuth'
import { findRootFolder, createFolder } from '../drive/driveClient'

async function ensureFolder(token: string, rootId: string, name: string, kind: string): Promise<string> {
  const q = encodeURIComponent(`name='${name}' and trashed=false and '${rootId}' in parents`)
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  if (res.ok) {
    const d = await res.json()
    const f = (d.files || [])[0]
    if (f?.id) return f.id
  }
  const created = await createFolder(token, name, [rootId], { kind, rootId })
  return created.id
}

async function getFolderIds(token: string): Promise<{ rootId: string; archivosId: string; originalesId: string; galeriaId: string; miniaturasId: string; datosId: string; obrasId: string }> {
  const root = await findRootFolder(token)
  if (!root) throw new Error('Raíz no encontrada')
  let archivosId: string | null = null
  let datosId: string | null = null

  const qArch = encodeURIComponent(`name='archivos' and trashed=false and '${root.id}' in parents`)
  const urlArch = `https://www.googleapis.com/drive/v3/files?q=${qArch}&fields=files(id,name)`
  const resArch = await fetch(urlArch, { headers: { Authorization: 'Bearer ' + token } })
  if (resArch.ok) {
    const d = await resArch.json()
    archivosId = (d.files || [])[0]?.id || null
  }
  if (!archivosId) {
    const created = await createFolder(token, 'archivos', [root.id], { kind: 'archivos', rootId: root.id })
    archivosId = created.id
  }

  const qDatos = encodeURIComponent(`name='_datos' and trashed=false and '${root.id}' in parents`)
  const urlDatos = `https://www.googleapis.com/drive/v3/files?q=${qDatos}&fields=files(id,name)`
  const resDatos = await fetch(urlDatos, { headers: { Authorization: 'Bearer ' + token } })
  if (resDatos.ok) {
    const d = await resDatos.json()
    datosId = (d.files || [])[0]?.id || null
  }
  if (!datosId) {
    const created = await createFolder(token, '_datos', [root.id], { kind: 'datos', rootId: root.id })
    datosId = created.id
  }

  const originalesId = await ensureFolder(token, archivosId, 'originales', 'originales')
  const galeriaId = await ensureFolder(token, archivosId, 'galeria', 'galeria')
  const miniaturasId = await ensureFolder(token, archivosId, 'miniaturas', 'miniaturas')
  const obrasId = await ensureFolder(token, datosId, 'obras', 'obras')

  return { rootId: root.id, archivosId, originalesId, galeriaId, miniaturasId, datosId, obrasId }
}

export async function uploadDrawings(files: File[]): Promise<Obra[]> {
  const token = getToken()
  if (!token) throw new Error('No hay token')
  const folders = await getFolderIds(token)

  const obras: Obra[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const bmp = await fileToBitmap(file)
    const now = new Date()
    const isoDate = now.toISOString()
    const id = ulid()

    const originalBlob = file
    const galeriaBlob = await resizeToMaxDimensions(bmp, 2400, 'image/webp', 0.85)
    const galeriaMime = determineMime(galeriaBlob.type)
    const galeriaBlobFinal = galeriaMime === 'image/webp' ? galeriaBlob : await resizeToMaxDimensions(bmp, 2400, 'image/jpeg', 0.85)

    const miniDataUrl = await createMiniDataUrl(bmp, 480, 0.8)
    const miniBlob = await (await fetch(miniDataUrl)).blob()
    await uploadBlob(token, miniBlob, `${id}-mini.webp`, [folders.miniaturasId], { kind: 'miniatura', obraId: id })


    const originalName = `${id}-original`
    const galeriaNameFinal = galeriaBlobFinal.type.includes('jpeg') || galeriaBlobFinal.type.includes('jpg') ? `${id}.jpg` : `${id}.webp`
    const upOrig = await uploadBlob(token, originalBlob, originalName, [folders.originalesId], { kind: 'original', obraId: id })
    const upGal = await uploadBlob(token, galeriaBlobFinal, galeriaNameFinal, [folders.galeriaId], { kind: 'galeria', obraId: id })
    const archivo: Archivo = {
      id: ulid(),
      tipo: 'imagen',
      rol: 'tradicional',
      orden: 0,
      mime: galeriaBlobFinal.type || 'image/webp',
      ancho: bmp.width,
      alto: bmp.height,
      tomadaEn: isoDate,
      drive: {
        originalId: upOrig.id,
        galeriaId: upGal.id,
      },
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
      origen: 'tradicional',
      tecnicas: [],
      tags: [],
      coleccionIds: [],
      miniatura: miniDataUrl,
      archivos: [archivo],
    }

    await uploadJson(token, obra, `obra-${id}.json`, [folders.obrasId], { kind: 'obra', id })

    useGalleryStore.getState().addObra(obra)
    obras.push(obra)
  }

  return obras
}
