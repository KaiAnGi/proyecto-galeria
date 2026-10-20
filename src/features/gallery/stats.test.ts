import { describe, it, expect } from 'vitest'
import { computeStreak, totalDrawings, lastActiveDays } from './stats'

describe('computeStreak', () => {
  it('cuenta días consecutivos hasta hoy', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const t = today.toISOString().slice(0, 10)
    const y = new Date(today.getTime() - 86400000).toISOString().slice(0, 10)
    expect(computeStreak([y, t])).toBe(2)
  })

  it('se detiene cuando hay hueco', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const t = today.toISOString().slice(0, 10)
    const two = new Date(today.getTime() - 2 * 86400000).toISOString().slice(0, 10)
    expect(computeStreak([two, t])).toBe(1)
  })

  it('devuelve 0 sin fechas', () => {
    expect(computeStreak([])).toBe(0)
  })
})

describe('totalDrawings', () => {
  it('cuenta el total', () => {
    expect(totalDrawings(['2026-01-01', '2026-01-02'])).toBe(2)
  })
})

describe('lastActiveDays', () => {
  it('devuelve n días', () => {
    expect(lastActiveDays([]).length).toBe(7)
  })
})
