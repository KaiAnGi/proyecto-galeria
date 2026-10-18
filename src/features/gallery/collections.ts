export interface Coleccion {
  schema: 1
  id: string
  rev: number
  updatedAt: string
  nombre: string
  tipo: 'general' | 'cuaderno' | 'clase'
  color?: string
  orden: number
}
