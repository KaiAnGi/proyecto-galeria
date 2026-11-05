import type {
  GoogleCalendar,
  GoogleCalendarEvent,
  GoogleCalendarEventInput,
} from './types'

export const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

export class CalendarApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CalendarApiError'
    this.status = status
  }
}

async function assertCalendarOk(res: Response, label: string): Promise<void> {
  if (res.ok) return
  let detail = ''
  try {
    detail = await res.clone().text()
  } catch {
    detail = ''
  }
  throw new CalendarApiError(`${label}: ${res.status}${detail ? ` ${detail}` : ''}`, res.status)
}

export interface ListEventsOptions {
  timeMin?: string
  timeMax?: string
  privateExtendedProperty?: string[]
  maxResults?: number
  singleEvents?: boolean
}

export async function getCalendar(token: string, calendarId: string): Promise<GoogleCalendar> {
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}?fields=id,summary,description,timeZone`
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
  await assertCalendarOk(res, 'Calendar API error')
  return res.json()
}

export async function createCalendar(
  token: string,
  summary: string,
  timeZone: string,
): Promise<GoogleCalendar> {
  const res = await fetch(`${CALENDAR_API}/calendars?fields=id,summary,description,timeZone`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      description: 'Calendario privado de Kuromi Likes Your Drawings',
      timeZone,
    }),
  })
  await assertCalendarOk(res, 'Calendar API error')
  return res.json()
}

export async function listEvents(
  token: string,
  calendarId: string,
  options: ListEventsOptions = {},
): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      singleEvents: String(options.singleEvents ?? true),
      showDeleted: 'false',
      maxResults: String(options.maxResults ?? 2500),
    })
    if (options.timeMin) params.set('timeMin', options.timeMin)
    if (options.timeMax) params.set('timeMax', options.timeMax)
    if ((options.singleEvents ?? true) && (options.timeMin || options.timeMax)) {
      params.set('orderBy', 'startTime')
    }
    for (const property of options.privateExtendedProperty ?? []) {
      params.append('privateExtendedProperty', property)
    }
    if (pageToken) params.set('pageToken', pageToken)

    const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
    await assertCalendarOk(res, 'Calendar API error')
    const data = (await res.json()) as {
      items?: GoogleCalendarEvent[]
      nextPageToken?: string
    }
    events.push(...(data.items ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return events
}

export async function createEvent(
  token: string,
  calendarId: string,
  event: GoogleCalendarEventInput,
): Promise<GoogleCalendarEvent> {
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?fields=id,status,summary,description,start,end,htmlLink,etag,extendedProperties`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })
  await assertCalendarOk(res, 'Calendar API error')
  return res.json()
}

export async function patchEvent(
  token: string,
  calendarId: string,
  eventId: string,
  event: Partial<GoogleCalendarEventInput>,
): Promise<GoogleCalendarEvent> {
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?fields=id,status,summary,description,start,end,htmlLink,etag,extendedProperties`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })
  await assertCalendarOk(res, 'Calendar API error')
  return res.json()
}

export async function deleteEvent(token: string, calendarId: string, eventId: string): Promise<void> {
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token },
  })
  if (res.status === 404) return
  await assertCalendarOk(res, 'Calendar API error')
}
