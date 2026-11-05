import type { GoogleCalendarEvent } from './types'

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return formatIsoDate(date)
}

export function localIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function eventStartDate(event: GoogleCalendarEvent): string | null {
  if (event.start.date) return event.start.date
  if (event.start.dateTime) return localIsoDate(new Date(event.start.dateTime))
  return null
}

export function eventDates(event: GoogleCalendarEvent): string[] {
  const start = event.start.date
  if (start) {
    const end = event.end.date ?? addDaysIso(start, 1)
    const dates: string[] = []
    let current = start
    let guard = 0
    while (current < end && guard < 1000) {
      dates.push(current)
      current = addDaysIso(current, 1)
      guard += 1
    }
    return dates
  }

  const startDate = eventStartDate(event)
  return startDate ? [startDate] : []
}

export function eventTimeLabel(event: GoogleCalendarEvent): string | undefined {
  if (!event.start.dateTime) return undefined
  return new Date(event.start.dateTime).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
