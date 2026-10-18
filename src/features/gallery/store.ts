import { create } from 'zustand'

export interface Archivo {
  id: string
  tipo: 'imagen' | 'gif' | 'video' | 'otro'
  rol: 'tradicional' | 'digital' | 'proceso' | 'referencia'
  etapa?: 'boceto' | 'lineart' | 'color' | 'final'
  orden: number
  mime: string
  bytes?: number
  ancho?: number
  alto?: number
  tomadaEn?: string
  drive: { originalId: string; galeriaId?: string; miniaturaId?: string }
  recorte?: { esquinas: [number, number, number, number][] | any }
  ajustes?: { brillo: number; contraste: number; blanquearPapel: boolean }
}

export interface Obra {
  schema: 1
  id: string
  rev: number
  creadaEn: string
  updatedAt: string
  titulo: string
  fecha: string
  estado: 'boceto' | 'en_proceso' | 'terminada'
  origen: 'tradicional' | 'digital' | 'mixto'
  tecnicas: string[]
  soporte?: { cuaderno?: string; formato?: string; ancho_cm?: number; alto_cm?: number }
  notas?: string
  tags: string[]
  coleccionIds: string[]
  ordenEnColeccion?: Record<string, number>
  portadaArchivoId?: string
  miniatura: string
  paletaHex?: string[]
  archivos: Archivo[]
}

interface GalleryState {
  obras: Obra[]
  addObra: (obra: Obra) => void
  updateObra: (id: string, patch: Partial<Obra>) => void
  removeObraSoft: (id: string) => void
  clearTrashUndo: (id: string) => void
  trashedById: Record<string, Obra | null>
}

export const useGalleryStore = create<GalleryState>((set) => ({
  obras: [],
  addObra: (obra) => set((state) => ({ obras: [obra, ...state.obras] })),
  updateObra: (id, patch) =>
    set((state) => ({
      obras: state.obras.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o)),
    })),
  removeObraSoft: (id) =>
    set((state) => {
      const obra = state.obras.find((o) => o.id === id)
      if (!obra) return state
      return {
        obras: state.obras.filter((o) => o.id !== id),
        trashedById: { ...state.trashedById, [id]: obra },
      }
    }),
  clearTrashUndo: (id) =>
    set((state) => {
      const next = { ...state.trashedById }
      delete next[id]
      return { trashedById: next }
    }),
  trashedById: {},
}))
