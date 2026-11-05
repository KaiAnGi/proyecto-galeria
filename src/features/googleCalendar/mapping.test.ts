import { describe, expect, it } from 'vitest'
import { addDaysIso, eventDates, eventStartDate, eventTimeLabel, localIsoDate } from './mapping'
import type { GoogleCalendarEvent } from './types'

function event(partial: Partial<GoogleCalendarEvent>): GoogleCalendarEvent {
  return {
    id: 'event-1',
    start: { date: '2026-01-05' },
    end: { date: '2026-01-06' },
    ...partial,
  }
}

describe('calendar mapping', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDaysIso('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('formats a local date without shifting time zones', () => {
    expect(localIsoDate(new Date(2026, 6, 9))).toBe('2026-07-09')
  })

  it('reads all-day and timed start dates', () => {
    expect(eventStartDate(event({}))).toBe('2026-01-05')
    expect(
      eventStartDate(
        event({
          start: { dateTime: '2026-01-05T22:30:00' },
          end: { dateTime: '2026-01-05T23:30:00' },
        }),
      ),
    ).toBe('2026-01-05')
  })

  it('expands multi-day all-day events, using the exclusive end date', () => {
    expect(
      eventDates(
        event({
          start: { date: '2026-01-30' },
          end: { date: '2026-02-02' },
        }),
      ),
    ).toEqual(['2026-01-30', '2026-01-31', '2026-02-01'])
  })

  it('shows one date for timed events', () => {
    expect(
      eventDates(
        event({
          start: { dateTime: '2026-01-05T10:00:00' },
          end: { dateTime: '2026-01-05T11:00:00' },
        }),
      ),
    ).toEqual(['2026-01-05'])
  })

  it('returns no date when Google sends neither date nor dateTime', () => {
    expect(eventStartDate(event({ start: {}, end: {} }))).toBeNull()
    expect(eventDates(event({ start: {}, end: {} }))).toEqual([])
  })

  it('shows a time only for timed events', () => {
    expect(eventTimeLabel(event({}))).toBeUndefined()
    expect(
      eventTimeLabel(
        event({
          start: { dateTime: '2026-01-05T10:00:00' },
          end: { dateTime: '2026-01-05T11:00:00' },
        }),
      ),
    ).toMatch(/\d{2}:\d{2}/)
  })
})
