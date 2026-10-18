export interface Frame {
  id: string
  orden: number
  drive: { originalId: string; galeriaId: string }
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
  miniatura: string
}
