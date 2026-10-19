import type { Obra } from './store'

export interface ObrasFilters {
  query: string
  estado: string
  coleccionId: string
  tecnica: string
  etiqueta: string
}

export const emptyFilters: ObrasFilters = {
  query: '',
  estado: '',
  coleccionId: '',
  tecnica: '',
  etiqueta: '',
}

export function hasActiveFilters(f: ObrasFilters): boolean {
  return f.query.trim() !== '' || f.estado !== '' || f.coleccionId !== '' || f.tecnica !== '' || f.etiqueta !== ''
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function matchesQuery(obra: Obra, rawQuery: string): boolean {
  const query = normalize(rawQuery.trim())
  if (!query) return true
  const haystack = normalize(`${obra.titulo} ${obra.notas ?? ''}`)
  return haystack.includes(query)
}

export function filterObras(obras: Obra[], f: ObrasFilters): Obra[] {
  return obras.filter((obra) => {
    if (!matchesQuery(obra, f.query)) return false
    if (f.estado && obra.estado !== f.estado) return false
    if (f.coleccionId && !obra.coleccionIds.includes(f.coleccionId)) return false
    if (f.tecnica && !obra.tecnicas.includes(f.tecnica)) return false
    if (f.etiqueta && !obra.tags.includes(f.etiqueta)) return false
    return true
  })
}

export interface Facets {
  tecnicas: string[]
  etiquetas: string[]
}

export function collectFacets(obras: Obra[]): Facets {
  const tecnicas = new Set<string>()
  const etiquetas = new Set<string>()
  for (const obra of obras) {
    for (const t of obra.tecnicas) if (t) tecnicas.add(t)
    for (const t of obra.tags) if (t) etiquetas.add(t)
  }
  return {
    tecnicas: [...tecnicas].sort((a, b) => a.localeCompare(b, 'es')),
    etiquetas: [...etiquetas].sort((a, b) => a.localeCompare(b, 'es')),
  }
}

export function parseList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}
