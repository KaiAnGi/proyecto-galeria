import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCalendar,
  createEvent,
  deleteEvent,
  getCalendar,
  listEvents,
  patchEvent,
} from './calendarApi'
import type { GoogleCalendarEvent } from './types'

function jsonResponse(data: unknown): Response {
  return { ok: true, status: 200, json: async () => data } as unknown as Response
}

function errorResponse(status: number, detail: string): Response {
  const response = {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => detail,
  }
  return {
    ...response,
    clone: () => response,
  } as unknown as Response
}

function eventInput() {
  return {
    summary: 'Entrega de clase',
    start: { date: '2026-02-10' },
    end: { date: '2026-02-11' },
  }
}

describe('Google Calendar API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('lists every page and forwards filters', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [{ id: 'event-1' }],
          nextPageToken: 'page-2',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'event-2' }] }))
    vi.stubGlobal('fetch', fetch)

    const events = await listEvents('token', 'calendar/1', {
      timeMin: '2026-02-01T00:00:00.000Z',
      timeMax: '2026-03-01T00:00:00.000Z',
      privateExtendedProperty: ['entregaId=entrega-1', 'app=kuromi'],
      maxResults: 50,
    })

    expect(events.map((item) => item.id)).toEqual(['event-1', 'event-2'])
    expect(fetch).toHaveBeenCalledTimes(2)

    const firstUrl = new URL(String(fetch.mock.calls[0][0]))
    expect(firstUrl.pathname).toContain('/calendars/calendar%2F1/events')
    expect(firstUrl.searchParams.get('singleEvents')).toBe('true')
    expect(firstUrl.searchParams.get('showDeleted')).toBe('false')
    expect(firstUrl.searchParams.get('maxResults')).toBe('50')
    expect(firstUrl.searchParams.get('orderBy')).toBe('startTime')
    expect(firstUrl.searchParams.getAll('privateExtendedProperty')).toEqual([
      'entregaId=entrega-1',
      'app=kuromi',
    ])

    const secondUrl = new URL(String(fetch.mock.calls[1][0]))
    expect(secondUrl.searchParams.get('pageToken')).toBe('page-2')
    expect(fetch.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer token' })
  })

  it('lists recurring masters without ordering when single events are disabled', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ items: [] }))
    vi.stubGlobal('fetch', fetch)

    await listEvents('token', 'calendar-1', {
      singleEvents: false,
      timeMin: '2026-02-01T00:00:00.000Z',
    })

    const url = new URL(String(fetch.mock.calls[0][0]))
    expect(url.searchParams.get('singleEvents')).toBe('false')
    expect(url.searchParams.get('orderBy')).toBeNull()
  })

  it('creates and patches events with JSON bodies', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'event-1', ...eventInput() }))
      .mockResolvedValueOnce(jsonResponse({ id: 'event-1', summary: 'Editada' }))
    vi.stubGlobal('fetch', fetch)

    await createEvent('token', 'calendar-1', eventInput())
    await patchEvent('token', 'calendar-1', 'event/1', { summary: 'Editada' })

    const createInit = fetch.mock.calls[0][1]
    expect(createInit.method).toBe('POST')
    expect(createInit.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(createInit.body)).toEqual(eventInput())

    const patchInit = fetch.mock.calls[1][1]
    expect(patchInit.method).toBe('PATCH')
    expect(String(fetch.mock.calls[1][0])).toContain('/events/event%2F1')
    expect(JSON.parse(patchInit.body)).toEqual({ summary: 'Editada' })
  })

  it('creates and gets the dedicated calendar', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'calendar-1', summary: 'Kuromi' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'calendar-1', summary: 'Kuromi' }))
    vi.stubGlobal('fetch', fetch)

    const created = await createCalendar('token', 'Kuromi', 'Europe/Madrid')
    const loaded = await getCalendar('token', 'calendar-1')

    expect(created.id).toBe('calendar-1')
    expect(loaded.summary).toBe('Kuromi')

    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body).toMatchObject({ summary: 'Kuromi', timeZone: 'Europe/Madrid' })
    expect(body.description).toContain('Kuromi Likes Your Drawings')
  })

  it('treats an already missing event as deleted', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(errorResponse(404, 'notFound'))
    vi.stubGlobal('fetch', fetch)

    await expect(deleteEvent('token', 'calendar-1', 'event-1')).resolves.toBeUndefined()
  })

  it('throws a CalendarApiError with status and detail', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(errorResponse(403, 'Forbidden'))
    vi.stubGlobal('fetch', fetch)

    await expect(getCalendar('token', 'calendar-1')).rejects.toMatchObject({
      name: 'CalendarApiError',
      status: 403,
      message: expect.stringContaining('Forbidden'),
    })
  })

  it('keeps all-day events typed as dates', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'event-1',
            start: { date: '2026-02-10' },
            end: { date: '2026-02-11' },
          } satisfies GoogleCalendarEvent,
        ],
      }),
    )
    vi.stubGlobal('fetch', fetch)

    const events = await listEvents('token', 'calendar-1')
    expect(events[0].start.date).toBe('2026-02-10')
    expect(events[0].start.dateTime).toBeUndefined()
  })
})
