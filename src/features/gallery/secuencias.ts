export interface Frame {
  id: string
  orden: number
  hold?: number
  drive: { originalId?: string; galeriaId: string }
}

export interface Secuencia {
  schema: 1
  id: string
  rev: number
  updatedAt: string
  titulo: string
  fps: number
  bucle: boolean
  frames: Frame[]
  mainFileId?: string
  folderId?: string
  videoMime?: string
  miniatura: string
  coleccionIds?: string[]
  portadaFrameId?: string
  bucleRango?: [number, number]
  exportSettings?: {
    width?: number
    height?: number
    repeats?: number
    background?: 'black' | 'white'
  }
}

export function withUpdatedAt<T extends object>(value: T): T & { updatedAt: string } {
  return { ...value, updatedAt: new Date().toISOString() }
}
