import JSZip from 'jszip'
import { downloadFileAsBlob } from '../../features/drive/driveImageClient'
import type { Coleccion, Entrega, Obra } from '../../features/gallery/store'
import type { Secuencia } from '../../features/gallery/secuencias'

interface ExportState {
  obras: Obra[]
  colecciones: Coleccion[]
  secuencias: Secuencia[]
  entregas?: Entrega[]
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
}

function extensionFor(mime: string): string {
  return EXTENSIONS[mime] ?? 'bin'
}

function safeName(value: string, fallback: string): string {
  const clean = Array.from(value)
    .map((char) => (char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? '_' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return clean || fallback
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) return null
  const mime = match[1] || 'application/octet-stream'
  const body = match[2] ? atob(match[3]) : decodeURIComponent(match[3])
  const bytes = new Uint8Array(body.length)
  for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function isAuthError(e: unknown): boolean {
  return e instanceof Error && /(?:401|403)/.test(e.message)
}

export async function exportAllToZip(state: ExportState, token: string): Promise<Blob> {
  const zip = new JSZip()
  const blobs = new Map<string, Blob>()
  const skipped: string[] = []

  async function getBlob(fileId: string): Promise<Blob | null> {
    const cached = blobs.get(fileId)
    if (cached) return cached
    try {
      const blob = await downloadFileAsBlob(token, fileId)
      blobs.set(fileId, blob)
      return blob
    } catch (e) {
      if (isAuthError(e)) throw e
      skipped.push(fileId)
      return null
    }
  }

  async function addFile(
    folder: JSZip,
    nameWithoutExtension: string,
    fileId: string,
    fallbackMime: string,
  ): Promise<void> {
    const blob = await getBlob(fileId)
    if (!blob) return
    folder.file(`${nameWithoutExtension}.${extensionFor(blob.type || fallbackMime)}`, blob)
  }

  zip.file('obras.json', JSON.stringify(state.obras, null, 2))
  zip.file('colecciones.json', JSON.stringify(state.colecciones, null, 2))
  zip.file('secuencias.json', JSON.stringify(state.secuencias, null, 2))
  zip.file('entregas.json', JSON.stringify(state.entregas ?? [], null, 2))

  for (const obra of state.obras) {
    const folderName = `${safeName(obra.titulo, 'sin-titulo')}-${obra.id}`
    const folder = zip.folder(`obras/${folderName}`)
    if (!folder) continue

    folder.file('obra.json', JSON.stringify(obra, null, 2))

    for (const archivo of obra.archivos) {
      if (archivo.drive.originalId) {
        await addFile(folder, `original-${archivo.id}`, archivo.drive.originalId, archivo.mime)
      }
      if (archivo.drive.galeriaId) {
        await addFile(folder, `galeria-${archivo.id}`, archivo.drive.galeriaId, archivo.mime)
      }
      if (archivo.drive.miniaturaId) {
        await addFile(folder, `miniatura-${archivo.id}`, archivo.drive.miniaturaId, 'image/jpeg')
      }
    }

    if (obra.miniatura.startsWith('data:')) {
      const miniatura = dataUrlToBlob(obra.miniatura)
      if (miniatura) folder.file(`miniatura.${extensionFor(miniatura.type || 'image/webp')}`, miniatura)
    }
  }

  for (const coleccion of state.colecciones) {
    const folder = zip.folder(`colecciones/${safeName(coleccion.nombre, 'coleccion')}-${coleccion.id}`)
    folder?.file('coleccion.json', JSON.stringify(coleccion, null, 2))
  }

  for (const secuencia of state.secuencias) {
    const folder = zip.folder(`animaciones/${safeName(secuencia.titulo, 'animacion')}-${secuencia.id}`)
    if (!folder) continue
    folder.file('secuencia.json', JSON.stringify(secuencia, null, 2))
    for (const frame of secuencia.frames) {
      await addFile(folder, `fotograma-${frame.id}`, frame.drive.galeriaId, 'image/webp')
    }
  }

  for (const entrega of state.entregas ?? []) {
    zip.file(`entregas/${safeName(entrega.titulo, 'entrega')}-${entrega.id}.json`, JSON.stringify(entrega, null, 2))
  }

  if (skipped.length > 0) {
    zip.file('archivos-no-incluidos.txt', `No se pudieron descargar estos archivos:\n${skipped.join('\n')}\n`)
  }

  zip.file(
    'LEEME.txt',
    'Esta es una copia de tu galería. Los datos están en los archivos JSON y las imágenes en las carpetas de cada obra.\n',
  )

  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}
