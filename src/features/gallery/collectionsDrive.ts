import { uploadJson } from '../drive/driveImageClient'
import { findRootFolder, createFolder } from '../drive/driveClient'
import type { Coleccion } from './store'

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

export async function saveColeccion(token: string, coleccion: Coleccion) {
  const root = await findRootFolder(token)
  if (!root) throw new Error('Raíz no encontrada')
  let datosId: string | null = null
  const qDatos = encodeURIComponent(`name='_datos' and trashed=false and '${root.id}' in parents`)
  const urlDatos = `https://www.googleapis.com/drive/v3/files?q=${qDatos}&fields=files(id,name)`
  const resDatos = await fetch(urlDatos, { headers: { Authorization: 'Bearer ' + token } })
  if (resDatos.ok) {
    const d = await resDatos.json()
    datosId = (d.files || [])[0]?.id || null
  }
  if (!datosId) datosId = (await createFolder(token, '_datos', [root.id], { kind: 'datos', rootId: root.id })).id
  const coleccionesId = await ensureFolder(token, datosId, 'colecciones', 'colecciones')
  const name = `coleccion-${coleccion.id}.json`
  await uploadJson(token, coleccion, name, [coleccionesId], { kind: 'coleccion', id: coleccion.id })
}
