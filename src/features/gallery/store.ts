import { create } from 'zustand'
import type { Secuencia } from './secuencias'

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

export interface Coleccion {
  schema: 1
  id: string
  rev: number
  updatedAt: string
  nombre: string
  tipo: 'general' | 'cuaderno' | 'clase'
  color?: string
  orden: number
  driveFolderId?: string
}

export interface Entrega {
  schema: 1
  id: string
  rev: number
  updatedAt: string
  titulo: string
  asignatura?: string
  fechaLimite?: string
  estado: 'pendiente' | 'en_curso' | 'entregada'
  notas?: string
  obraIds: string[]
}

interface GalleryState {
  obras: Obra[]
  colecciones: Coleccion[]
  secuencias: Secuencia[]
  entregas: Entrega[]
  addObra: (obra: Obra) => void
  updateObra: (id: string, patch: Partial<Obra>) => void
  removeObraSoft: (id: string) => void
  addColeccion: (c: Coleccion) => void
  updateColeccion: (id: string, patch: Partial<Coleccion>) => void
  removeColeccion: (id: string) => void
  addObraToColeccion: (obraId: string, coleccionId: string, orden?: number) => void
  removeObraFromColeccion: (obraId: string, coleccionId: string) => void
  addSecuencia: (s: Secuencia) => void
  updateSecuencia: (id: string, patch: Partial<Secuencia>) => void
  removeSecuencia: (id: string) => void
  addSecuenciaToColeccion: (secuenciaId: string, coleccionId: string) => void
  removeSecuenciaFromColeccion: (secuenciaId: string, coleccionId: string) => void
  addEntrega: (e: Entrega) => void
  updateEntrega: (id: string, patch: Partial<Entrega>) => void
  removeEntrega: (id: string) => void
  hydrate: (state: Partial<GalleryState>) => void
}

export const useGalleryStore = create<GalleryState>((set) => ({
  obras: [],
  colecciones: [],
  secuencias: [],
  entregas: [],
  addObra: (obra) => set((state) => ({ obras: [obra, ...state.obras] })),
  updateObra: (id, patch) =>
    set((state) => ({
      obras: state.obras.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o)),
    })),
  removeObraSoft: (id) => set((state) => ({ obras: state.obras.filter((o) => o.id !== id) })),
  addColeccion: (c) => set((state) => ({ colecciones: [c, ...state.colecciones] })),
  updateColeccion: (id, patch) =>
    set((state) => ({
      colecciones: state.colecciones.map((col) => (col.id === id ? { ...col, ...patch, updatedAt: new Date().toISOString() } : col)),
    })),
  removeColeccion: (id) => set((state) => ({ colecciones: state.colecciones.filter((col) => col.id !== id) })),
  addObraToColeccion: (obraId, coleccionId, orden) =>
    set((state) => ({
      obras: state.obras.map((o) =>
        o.id === obraId
          ? {
              ...o,
              coleccionIds: o.coleccionIds.includes(coleccionId) ? o.coleccionIds : [...o.coleccionIds, coleccionId],
              ordenEnColeccion: { ...(o.ordenEnColeccion || {}), [coleccionId]: orden ?? (o.ordenEnColeccion?.[coleccionId] ?? 0) },
              updatedAt: new Date().toISOString(),
            }
          : o,
      ),
    })),
  removeObraFromColeccion: (obraId, coleccionId) =>
    set((state) => ({
      obras: state.obras.map((o) => {
        if (o.id !== obraId) return o
        const nextIds = o.coleccionIds.filter((id) => id !== coleccionId)
        const nextOrden = { ...(o.ordenEnColeccion || {}) }
        delete nextOrden[coleccionId]
        return { ...o, coleccionIds: nextIds, ordenEnColeccion: nextOrden, updatedAt: new Date().toISOString() }
      }),
    })),
  addSecuencia: (s) => set((state) => ({ secuencias: [s, ...state.secuencias] })),
  updateSecuencia: (id, patch) =>
    set((state) => ({
      secuencias: state.secuencias.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)),
    })),
  removeSecuencia: (id) => set((state) => ({ secuencias: state.secuencias.filter((s) => s.id !== id) })),
  addSecuenciaToColeccion: (secuenciaId, coleccionId) =>
    set((state) => ({
      secuencias: state.secuencias.map((s) =>
        s.id === secuenciaId
          ? {
              ...s,
              coleccionIds: (s.coleccionIds ?? []).includes(coleccionId)
                ? s.coleccionIds
                : [...(s.coleccionIds ?? []), coleccionId],
              updatedAt: new Date().toISOString(),
            }
          : s,
      ),
    })),
  removeSecuenciaFromColeccion: (secuenciaId, coleccionId) =>
    set((state) => ({
      secuencias: state.secuencias.map((s) =>
        s.id === secuenciaId
          ? {
              ...s,
              coleccionIds: (s.coleccionIds ?? []).filter((id) => id !== coleccionId),
              updatedAt: new Date().toISOString(),
            }
          : s,
      ),
    })),
  addEntrega: (e) => set((state) => ({ entregas: [e, ...state.entregas] })),
  updateEntrega: (id, patch) =>
    set((state) => ({
      entregas: state.entregas.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e)),
    })),
  removeEntrega: (id) => set((state) => ({ entregas: state.entregas.filter((e) => e.id !== id) })),
  hydrate: (state) => set((prev) => ({ ...prev, ...state })),
}))
