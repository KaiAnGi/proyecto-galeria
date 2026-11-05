import type { CalendarioEvento, Entrega } from '../gallery/store'
import {
  CalendarApiError,
  createCalendar,
  createEvent,
  deleteEvent,
  getCalendar,
  listEvents,
  patchEvent,
} from './calendarApi'
import { loadCalendarConfig, saveCalendarConfig, type CalendarConfig } from './config'
import { addDaysIso } from './mapping'
import type { GoogleCalendarEvent, GoogleCalendarEventInput } from './types'

export const KUROMI_CALENDAR_NAME = 'Kuromi Likes Your Drawings'
export const CALENDAR_APP_ID = 'kuromi-likes-your-drawings'
export const ENTREGA_PROPERTY = 'entregaId'
export const LEGACY_PROPERTY = 'legacyDriveId'

function privateProperties(event: GoogleCalendarEvent): Record<string, string> {
  return event.extendedProperties?.private ?? {}
}

function eventTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function allDayEvent(
  date: string,
  summary: string,
  description: string | undefined,
  properties: Record<string, string>,
): GoogleCalendarEventInput {
  return {
    summary,
    description: description || undefined,
    start: { date },
    end: { date: addDaysIso(date, 1) },
    extendedProperties: {
      private: {
        app: CALENDAR_APP_ID,
        ...properties,
      },
    },
  }
}

function entregaEvent(entrega: Entrega): GoogleCalendarEventInput | null {
  if (!entrega.fechaLimite) return null
  const description = [entrega.asignatura, entrega.notas].filter(Boolean).join('\n\n')
  return allDayEvent(entrega.fechaLimite, entrega.titulo, description, {
    [ENTREGA_PROPERTY]: entrega.id,
  })
}

function legacyEvent(event: CalendarioEvento): GoogleCalendarEventInput {
  return allDayEvent(event.fecha, event.titulo, event.notas, {
    [LEGACY_PROPERTY]: event.id,
  })
}

function sameEvent(
  existing: GoogleCalendarEvent,
  desired: GoogleCalendarEventInput,
): boolean {
  return (
    existing.summary === desired.summary &&
    (existing.description ?? '') === (desired.description ?? '') &&
    existing.start.date === desired.start.date &&
    existing.end.date === desired.end.date
  )
}

async function ensureKuromiCalendar(
  token: string,
): Promise<{ calendarId: string; config: CalendarConfig }> {
  const config = await loadCalendarConfig(token)

  if (config?.calendarId) {
    try {
      await getCalendar(token, config.calendarId)
      return { calendarId: config.calendarId, config }
    } catch (error) {
      if (!(error instanceof CalendarApiError) || error.status !== 404) throw error
    }
  }

  const calendar = await createCalendar(token, KUROMI_CALENDAR_NAME, eventTimeZone())
  const nextConfig = await saveCalendarConfig(token, {
    calendarId: calendar.id,
    calendarMigratedAt: undefined,
  })
  return { calendarId: calendar.id, config: nextConfig }
}

async function migrateLegacyEvents(
  token: string,
  calendarId: string,
  events: GoogleCalendarEvent[],
  legacyEvents: CalendarioEvento[],
): Promise<void> {
  const known = new Set(
    events
      .map((event) => privateProperties(event)[LEGACY_PROPERTY])
      .filter((id): id is string => Boolean(id)),
  )

  for (const legacy of legacyEvents) {
    if (known.has(legacy.id)) continue
    await createEvent(token, calendarId, legacyEvent(legacy))
    known.add(legacy.id)
  }
}

async function syncEntregas(
  token: string,
  calendarId: string,
  events: GoogleCalendarEvent[],
  entregas: Entrega[],
): Promise<void> {
  const byEntrega = new Map<string, GoogleCalendarEvent>()
  for (const event of events) {
    const id = privateProperties(event)[ENTREGA_PROPERTY]
    if (id && !byEntrega.has(id)) byEntrega.set(id, event)
  }

  for (const entrega of entregas) {
    const existing = byEntrega.get(entrega.id)
    const desired = entregaEvent(entrega)

    if (!desired) {
      if (existing) await deleteEvent(token, calendarId, existing.id)
      continue
    }

    if (existing && sameEvent(existing, desired)) continue
    if (existing) {
      await patchEvent(token, calendarId, existing.id, desired)
    } else {
      const created = await createEvent(token, calendarId, desired)
      byEntrega.set(entrega.id, created)
    }
  }
}

export interface CalendarSetup {
  calendarId: string
  migrated: boolean
}

let setupPromise: Promise<CalendarSetup> | null = null

async function runSetup(
  token: string,
  legacyEvents: CalendarioEvento[],
  entregas: Entrega[],
): Promise<CalendarSetup> {
  const { calendarId, config } = await ensureKuromiCalendar(token)
  const events = await listEvents(token, calendarId, { singleEvents: false })
  let migrated = Boolean(config.calendarMigratedAt)

  if (!migrated) {
    try {
      await migrateLegacyEvents(token, calendarId, events, legacyEvents)
      await saveCalendarConfig(token, { calendarMigratedAt: new Date().toISOString() })
      migrated = true
    } catch (error) {
      console.warn('Legacy calendar migration failed', error)
    }
  }

  try {
    await syncEntregas(token, calendarId, events, entregas)
  } catch (error) {
    console.warn('Entrega calendar sync failed', error)
  }

  return { calendarId, migrated }
}

export function setupKuromiCalendar(
  token: string,
  legacyEvents: CalendarioEvento[],
  entregas: Entrega[],
): Promise<CalendarSetup> {
  if (setupPromise) return setupPromise
  setupPromise = runSetup(token, legacyEvents, entregas).finally(() => {
    setupPromise = null
  })
  return setupPromise
}

export async function syncEntregaToCalendar(token: string, entrega: Entrega): Promise<void> {
  const config = await loadCalendarConfig(token)
  if (!config?.calendarId) return

  const events = await listEvents(token, config.calendarId, {
    privateExtendedProperty: [`${ENTREGA_PROPERTY}=${entrega.id}`],
  })
  const existing = events[0]
  const desired = entregaEvent(entrega)

  if (!desired) {
    if (existing) await deleteEvent(token, config.calendarId, existing.id)
    return
  }

  if (existing) {
    if (!sameEvent(existing, desired)) {
      await patchEvent(token, config.calendarId, existing.id, desired)
    }
    return
  }

  await createEvent(token, config.calendarId, desired)
}

export async function deleteEntregaFromCalendar(token: string, entregaId: string): Promise<void> {
  const config = await loadCalendarConfig(token)
  if (!config?.calendarId) return

  const events = await listEvents(token, config.calendarId, {
    privateExtendedProperty: [`${ENTREGA_PROPERTY}=${entregaId}`],
  })
  await Promise.allSettled(events.map((event) => deleteEvent(token, config.calendarId!, event.id)))
}
