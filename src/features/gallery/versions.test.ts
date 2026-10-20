import { describe, it, expect } from 'vitest'
import { versionLabel, sortVersiones, imageVersiones, comparePair, computeOrigen, isEtapa } from './versions'
import type { Archivo, Obra } from './store'

function archivo(overrides: Partial<Archivo>): Archivo {
  return {
    id: 'a1',
    tipo: 'imagen',
    rol: 'tradicional',
    orden: 0,
    mime: 'image/webp',
    drive: { originalId: 'orig-1', galeriaId: 'gal-1' },
    ...overrides,
  }
}

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

describe('versionLabel', () => {
  it('usa la etapa cuando existe', () => {
    expect(versionLabel(archivo({ rol: 'digital', etapa: 'lineart' }))).toBe('Línea')
    expect(versionLabel(archivo({ rol: 'tradicional', etapa: 'final' }))).toBe('Final')
  })

  it('usa el rol cuando no hay etapa', () => {
    expect(versionLabel(archivo({ rol: 'tradicional' }))).toBe('En papel')
    expect(versionLabel(archivo({ rol: 'digital' }))).toBe('Digital')
    expect(versionLabel(archivo({ rol: 'proceso' }))).toBe('Proceso')
    expect(versionLabel(archivo({ rol: 'referencia' }))).toBe('Referencia')
  })
})

describe('sortVersiones', () => {
  it('ordena por etapa y después por orden', () => {
    const result = sortVersiones([
      archivo({ id: 'final', etapa: 'final', orden: 3 }),
      archivo({ id: 'boceto', rol: 'digital', etapa: 'boceto', orden: 1 }),
      archivo({ id: 'color', rol: 'digital', etapa: 'color', orden: 2 }),
      archivo({ id: 'lineart', rol: 'digital', etapa: 'lineart', orden: 4 }),
    ])
    expect(result.map((a) => a.id)).toEqual(['boceto', 'lineart', 'color', 'final'])
  })

  it('las versiones sin etapa van primero, por orden de subida', () => {
    const result = sortVersiones([
      archivo({ id: 'b', orden: 1 }),
      archivo({ id: 'final', etapa: 'final', orden: 0 }),
      archivo({ id: 'a', orden: 0 }),
    ])
    expect(result.map((a) => a.id)).toEqual(['a', 'b', 'final'])
  })
})

describe('comparePair', () => {
  it('devuelve null con menos de dos imágenes', () => {
    expect(comparePair(obra({ archivos: [] }))).toBeNull()
    expect(comparePair(obra({ archivos: [archivo({})] }))).toBeNull()
  })

  it('primer par: la versión sin etapa (tradicional) contra la última (digital final)', () => {
    const pair = comparePair(
      obra({
        archivos: [
          archivo({ id: 'foto', rol: 'tradicional', orden: 0 }),
          archivo({ id: 'final', rol: 'digital', etapa: 'final', orden: 1 }),
        ],
      }),
    )
    expect(pair?.[0].id).toBe('foto')
    expect(pair?.[1].id).toBe('final')
  })

  it('ignora vídeos y otros archivos no imagen', () => {
    const pair = comparePair(
      obra({
        archivos: [
          archivo({ id: 'video', tipo: 'video', rol: 'proceso', orden: 0, drive: { originalId: 'v1' } }),
          archivo({ id: 'papel', rol: 'tradicional', orden: 1 }),
          archivo({ id: 'digital', rol: 'digital', etapa: 'color', orden: 2 }),
        ],
      }),
    )
    expect(pair?.[0].id).toBe('papel')
    expect(pair?.[1].id).toBe('digital')
  })
})

describe('imageVersiones', () => {
  it('devuelve solo imágenes y gifs ordenadas', () => {
    const result = imageVersiones(
      obra({
        archivos: [
          archivo({ id: 'video', tipo: 'video', drive: { originalId: 'v1' } }),
          archivo({ id: 'gif', tipo: 'gif', rol: 'digital', orden: 1 }),
          archivo({ id: 'foto', rol: 'tradicional', orden: 0 }),
        ],
      }),
    )
    expect(result.map((a) => a.id)).toEqual(['foto', 'gif'])
  })
})

describe('computeOrigen', () => {
  it('mixto cuando hay papel y digital', () => {
    expect(
      computeOrigen([archivo({ rol: 'tradicional' }), archivo({ rol: 'digital', etapa: 'final' })]),
    ).toBe('mixto')
  })

  it('digital si todas son digitales', () => {
    expect(computeOrigen([archivo({ rol: 'digital' })])).toBe('digital')
  })

  it('tradicional si todas son de papel', () => {
    expect(computeOrigen([archivo({ rol: 'tradicional' }), archivo({ rol: 'tradicional', etapa: 'boceto' })])).toBe(
      'tradicional',
    )
  })
})

describe('isEtapa', () => {
  it('acepta solo las etapas conocidas', () => {
    expect(isEtapa('boceto')).toBe(true)
    expect(isEtapa('final')).toBe(true)
    expect(isEtapa('terminada')).toBe(false)
    expect(isEtapa('')).toBe(false)
  })
})
