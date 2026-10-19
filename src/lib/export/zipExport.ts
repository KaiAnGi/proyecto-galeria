import JSZip from 'jszip'

export async function exportAllToZip(state: {
  obras: any[]
  colecciones: any[]
  secuencias: any[]
  entregas?: any[]
}) {
  const zip = new JSZip()
  zip.file('obra.json', JSON.stringify(state.obras, null, 2))
  zip.file('colecciones.json', JSON.stringify(state.colecciones, null, 2))
  zip.file('secuencias.json', JSON.stringify(state.secuencias, null, 2))
  zip.file('entregas.json', JSON.stringify(state.entregas ?? [], null, 2))
  return await zip.generateAsync({ type: 'blob' })
}
