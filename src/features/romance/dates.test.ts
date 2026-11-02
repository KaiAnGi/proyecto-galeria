import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  daysTogether,
  daysUntilNextMonthiversary,
  isMonthiversary,
  nextMonthiversary,
  specialDay,
} from './dates'

function date(year: number, month: number, day: number) {
  return new Date(year, month - 1, day)
}

describe('romance dates', () => {
  it('counts the days since the relationship started', () => {
    expect(daysTogether(date(2026, 10, 14))).toBe(0)
    expect(daysTogether(date(2026, 11, 2))).toBe(19)
    expect(daysTogether(date(2027, 10, 14))).toBe(365)
  })

  it('does not count days before the relationship started', () => {
    expect(daysTogether(date(2026, 10, 1))).toBe(0)
  })

  it('finds the next monthiversary', () => {
    expect(nextMonthiversary(date(2026, 11, 2))).toEqual(date(2026, 11, 14))
    expect(nextMonthiversary(date(2026, 11, 14))).toEqual(date(2026, 12, 14))
    expect(nextMonthiversary(date(2026, 11, 20))).toEqual(date(2026, 12, 14))
    expect(nextMonthiversary(date(2026, 12, 20))).toEqual(date(2027, 1, 14))
  })

  it('calculates the countdown to the next monthiversary', () => {
    expect(daysUntilNextMonthiversary(date(2026, 11, 2))).toBe(12)
    expect(daysUntilNextMonthiversary(date(2026, 11, 14))).toBe(30)
  })

  it('detects the monthiversary day', () => {
    expect(isMonthiversary(date(2026, 11, 14))).toBe(true)
    expect(isMonthiversary(date(2026, 11, 13))).toBe(false)
  })

  it('detects special days', () => {
    expect(specialDay(date(2026, 11, 14))).toBe('monthiversary')
    expect(specialDay(date(2027, 8, 6))).toBe('birthday-partner')
    expect(specialDay(date(2027, 9, 2))).toBe('birthday-author')
    expect(specialDay(date(2026, 11, 2))).toBeNull()
  })

  it('calculates calendar days across daylight saving changes', () => {
    expect(daysBetween(date(2026, 3, 28), date(2026, 3, 30))).toBe(2)
    expect(daysBetween(date(2026, 10, 24), date(2026, 10, 26))).toBe(2)
  })
})
