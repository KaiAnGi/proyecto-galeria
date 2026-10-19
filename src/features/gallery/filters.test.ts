import { describe, it, expect } from 'vitest'
import { filterObras, collectFacets, parseList, hasActiveFilters, emptyFilters } from './filters'
import type { Obra } from './store'

function obra(overrides: Partial<Obra>): Obra {
  return {
    schema: 1,
    id: 'o1',
    rev: 1,
    creadaEn: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    titulo: 'Sin título',
    fecha: '2026-01-01',
    estado: 'terminada',
    origen: 'tradicional',
    tecnicas: [],
    tags: [],
    coleccionIds: [],
    miniatura: '',
    archivos: [],
    ...overrides,
  }
}

const list: Obra[] = [
  obra({ id: '1', titulo: 'Retrato de Ana', estado: 'terminada', tecnicas: ['lápiz'], tags: ['amiga'] }),
  obra({ id: '2', titulo: 'Boceto de clase', estado: 'boceto', tecnicas: ['bolígrafo'], tags: ['escuela'], notas: 'práctica de retrato rápido' }),
  obra({ id: '3', titulo: 'Gato dormido', estado: 'en_proceso', tecnicas: ['lápiz', 'acuarela'], tags: ['mascotas'], coleccionIds: ['col-9'] }),
]

describe('filterObras', () => {
  it('devuelve todo con filtros vacíos', () => {
    expect(filterObras(list, emptyFilters)).toHaveLength(3)
  })

  it('busca por título ignorando mayúsculas y acentos', () => {
    const result = filterObras(list, { ...emptyFilters, query: 'RETRATO' })
    expect(result.map((o) => o.id)).toEqual(['1', '2'])
  })

  it('busca también en las notas', () => {
    const result = filterObras(list, { ...emptyFilters, query: 'rápido' })
    expect(result.map((o) => o.id)).toEqual(['2'])
  })

  it('filtra por estado, colección, técnica y etiqueta a la vez', () => {
    const onlyEstado = filterObras(list, { ...emptyFilters, estado: 'terminada' })
    expect(onlyEstado.map((o) => o.id)).toEqual(['1'])

    const onlyColeccion = filterObras(list, { ...emptyFilters, coleccionId: 'col-9' })
    expect(onlyColeccion.map((o) => o.id)).toEqual(['3'])

    const onlyTecnica = filterObras(list, { ...emptyFilters, tecnica: 'lápiz' })
    expect(onlyTecnica.map((o) => o.id)).toEqual(['1', '3'])

    const combined = filterObras(list, {
      ...emptyFilters,
      tecnica: 'lápiz',
      estado: 'en_proceso',
      query: 'gato',
    })
    expect(combined.map((o) => o.id)).toEqual(['3'])
  })

  it('devuelve vacío cuando nada coincide', () => {
    expect(filterObras(list, { ...emptyFilters, query: 'zzz' })).toEqual([])
  })
})

describe('collectFacets', () => {
  it('recoge técnicas y etiquetas sin repetir, ordenadas', () => {
    const facets = collectFacets(list)
    expect(facets.tecnicas).toEqual(['acuarela', 'bolígrafo', 'lápiz'])
    expect(facets.etiquetas).toEqual(['amiga', 'escuela', 'mascotas'])
  })
})

describe('parseList', () => {
  it('separa por comas y limpia espacios', () => {
    expect(parseList(' lápiz, , acuarela ,')).toEqual(['lápiz', 'acuarela'])
    expect(parseList('')).toEqual([])
  })
})

describe('hasActiveFilters', () => {
  it('solo se activa con algo escrito o elegido', () => {
    expect(hasActiveFilters(emptyFilters)).toBe(false)
    expect(hasActiveFilters({ ...emptyFilters, query: '   ' })).toBe(false)
    expect(hasActiveFilters({ ...emptyFilters, estado: 'boceto' })).toBe(true)
    expect(hasActiveFilters({ ...emptyFilters, query: 'gato' })).toBe(true)
  })
})
