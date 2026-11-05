import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarioEvento, Entrega } from '../gallery/store'
import type { GoogleCalendarEvent } from './types'

vi.mock('./calendarApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./calendarApi')>()
  return {
    ...actual,
    getCalendar: vi.fn(),
    createCalendar: vi.fn(),
    listEvents: vi.fn(),
    createEvent: vi.fn(),
    patchEvent: vi.fn(),
    deleteEvent: vi.fn(),
  }
})

vi.mock('./config', () => ({
  loadCalendarConfig: vi.fn(),
  saveCalendarConfig: vi.fn(),
}))

import {
  CalendarApiError,
  createCalendar,
  createEvent,
  deleteEvent,
  getCalendar,
  listEvents,
  patchEvent,
} from './calendarApi'
import { loadCalendarConfig, saveCalendarConfig } from './config'
import {
  deleteEntregaFromCalendar,
  ENTREGA_PROPERTY,
  LEGACY_PROPERTY,
  setupKuromiCalendar,
  syncEntregaToCalendar,
} from './sync'

const legacy: CalendarioEvento = {
  schema: 1,
  id: 'legacy-1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Cumple de mamá',
  fecha: '2026-03-08',
  notas: 'Preparar tarta',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const entrega: Entrega = {
  schema: 1,
  id: 'entrega-1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Trabajo final',
  asignatura: 'Animación',
  fechaLimite: '2026-02-10',
  estado: 'pendiente',
  notas: 'Entregar en mano',
  obraIds: [],
}

function googleEvent(partial: Partial<GoogleCalendarEvent>): GoogleCalendarEvent {
  return {
    id: 'event-1',
    summary: 'Evento',
    start: { date: '2026-02-10' },
    end: { date: '2026-02-11' },
    ...partial,
  }
}

describe('Google Calendar sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadCalendarConfig).mockResolvedValue(null)
    vi.mocked(saveCalendarConfig).mockImplementation(async (_token, patch) => ({
      schema: 1,
      rev: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...patch,
    }))
    vi.mocked(getCalendar).mockResolvedValue({ id: 'cal-1', summary: 'Kuromi' })
    vi.mocked(createCalendar).mockResolvedValue({ id: 'cal-1', summary: 'Kuromi' })
    vi.mocked(listEvents).mockResolvedValue([])
    vi.mocked(createEvent).mockImplementation(async (_token, _calendarId, input) => ({
      id: 'event-new',
      ...input,
    }))
    vi.mocked(patchEvent).mockImplementation(async (_token, _calendarId, id, input) => ({
      id,
      summary: input.summary ?? '',
      start: input.start ?? { date: '' },
      end: input.end ?? { date: '' },
      description: input.description,
      extendedProperties: input.extendedProperties,
    }))
    vi.mocked(deleteEvent).mockResolvedValue()
  })

  it('creates the private calendar and migrates legacy events once', async () => {
    const result = await setupKuromiCalendar('token', [legacy], [entrega])

    expect(result).toEqual({ calendarId: 'cal-1', migrated: true })
    expect(createCalendar).toHaveBeenCalledWith('token', 'Kuromi Likes Your Drawings', expect.any(String))
    expect(createEvent).toHaveBeenCalledTimes(2)

    const legacyInput = vi.mocked(createEvent).mock.calls[0][2]
    expect(legacyInput).toMatchObject({
      summary: 'Cumple de mamá',
      description: 'Preparar tarta',
      start: { date: '2026-03-08' },
      end: { date: '2026-03-09' },
    })
    expect(legacyInput.extendedProperties?.private?.[LEGACY_PROPERTY]).toBe('legacy-1')

    const entregaInput = vi.mocked(createEvent).mock.calls[1][2]
    expect(entregaInput).toMatchObject({
      summary: 'Trabajo final',
      description: 'Animación\n\nEntregar en mano',
      start: { date: '2026-02-10' },
      end: { date: '2026-02-11' },
    })
    expect(entregaInput.extendedProperties?.private?.[ENTREGA_PROPERTY]).toBe('entrega-1')

    expect(saveCalendarConfig).toHaveBeenLastCalledWith('token', {
      calendarMigratedAt: expect.any(String),
    })
  })

  it('does not migrate again or duplicate events after migration', async () => {
    vi.mocked(loadCalendarConfig).mockResolvedValue({
      schema: 1,
      rev: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      calendarId: 'cal-1',
      calendarMigratedAt: '2026-01-02T00:00:00.000Z',
    })
    vi.mocked(listEvents).mockResolvedValue([
      googleEvent({
        id: 'legacy-event',
        summary: 'Cumple de mamá',
        description: 'Preparar tarta',
        start: { date: '2026-03-08' },
        end: { date: '2026-03-09' },
        extendedProperties: { private: { [LEGACY_PROPERTY]: 'legacy-1' } },
      }),
      googleEvent({
        id: 'entrega-event',
        summary: 'Trabajo final',
        description: 'Animación\n\nEntregar en mano',
        start: { date: '2026-02-10' },
        end: { date: '2026-02-11' },
        extendedProperties: { private: { [ENTREGA_PROPERTY]: 'entrega-1' } },
      }),
    ])

    const result = await setupKuromiCalendar('token', [legacy], [entrega])

    expect(result.migrated).toBe(true)
    expect(createCalendar).not.toHaveBeenCalled()
    expect(createEvent).not.toHaveBeenCalled()
    expect(patchEvent).not.toHaveBeenCalled()
  })

  it('patches changed deadlines and removes events for entregas without a date', async () => {
    vi.mocked(loadCalendarConfig).mockResolvedValue({
      schema: 1,
      rev: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      calendarId: 'cal-1',
      calendarMigratedAt: '2026-01-02T00:00:00.000Z',
    })
    vi.mocked(listEvents).mockResolvedValue([
      googleEvent({
        id: 'entrega-event',
        summary: 'Trabajo viejo',
        start: { date: '2026-02-01' },
        end: { date: '2026-02-02' },
        extendedProperties: { private: { [ENTREGA_PROPERTY]: 'entrega-1' } },
      }),
      googleEvent({
        id: 'old-deadline',
        summary: 'Sin fecha',
        extendedProperties: { private: { [ENTREGA_PROPERTY]: 'entrega-2' } },
      }),
    ])

    await setupKuromiCalendar(
      'token',
      [],
      [entrega, { ...entrega, id: 'entrega-2', titulo: 'Sin fecha', fechaLimite: undefined }],
    )

    expect(patchEvent).toHaveBeenCalledWith(
      'token',
      'cal-1',
      'entrega-event',
      expect.objectContaining({ summary: 'Trabajo final' }),
    )
    expect(deleteEvent).toHaveBeenCalledWith('token', 'cal-1', 'old-deadline')
  })

  it('shares one setup request when the calendar is opened twice in parallel', async () => {
    const first = setupKuromiCalendar('token', [legacy], [])
    const second = setupKuromiCalendar('token', [legacy], [])

    await Promise.all([first, second])

    expect(createCalendar).toHaveBeenCalledTimes(1)
    expect(createEvent).toHaveBeenCalledTimes(1)
  })

  it('recreates a missing calendar and resets the migration marker', async () => {
    vi.mocked(loadCalendarConfig).mockResolvedValue({
      schema: 1,
      rev: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      calendarId: 'deleted-calendar',
      calendarMigratedAt: '2026-01-02T00:00:00.000Z',
    })
    vi.mocked(getCalendar).mockRejectedValue(new CalendarApiError('Calendar API error: 404', 404))
    vi.mocked(createCalendar).mockResolvedValue({ id: 'cal-2', summary: 'Kuromi' })

    const result = await setupKuromiCalendar('token', [legacy], [])

    expect(result).toEqual({ calendarId: 'cal-2', migrated: true })
    expect(createCalendar).toHaveBeenCalledTimes(1)
    expect(saveCalendarConfig).toHaveBeenNthCalledWith(1, 'token', {
      calendarId: 'cal-2',
      calendarMigratedAt: undefined,
    })
    expect(createEvent).toHaveBeenCalledTimes(1)
  })

  it('keeps the migration marker when the calendar still exists', async () => {
    vi.mocked(loadCalendarConfig).mockResolvedValue({
      schema: 1,
      rev: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      calendarId: 'cal-1',
      calendarMigratedAt: '2026-01-02T00:00:00.000Z',
    })

    const result = await setupKuromiCalendar('token', [legacy], [])

    expect(result.migrated).toBe(true)
    expect(createCalendar).not.toHaveBeenCalled()
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('does nothing for an entrega while the private calendar does not exist', async () => {
    await syncEntregaToCalendar('token', entrega)

    expect(listEvents).not.toHaveBeenCalled()
    expect(createEvent).not.toHaveBeenCalled()
  })

  it('creates, updates and deletes a single entrega event', async () => {
    vi.mocked(loadCalendarConfig).mockResolvedValue({
      schema: 1,
      rev: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      calendarId: 'cal-1',
    })

    await syncEntregaToCalendar('token', entrega)
    expect(createEvent).toHaveBeenCalledWith(
      'token',
      'cal-1',
      expect.objectContaining({ summary: 'Trabajo final' }),
    )

    vi.mocked(listEvents).mockResolvedValue([
      googleEvent({
        id: 'entrega-event',
        summary: 'Trabajo viejo',
        extendedProperties: { private: { [ENTREGA_PROPERTY]: 'entrega-1' } },
      }),
    ])
    await syncEntregaToCalendar('token', entrega)
    expect(patchEvent).toHaveBeenCalledWith(
      'token',
      'cal-1',
      'entrega-event',
      expect.objectContaining({ summary: 'Trabajo final' }),
    )

    await syncEntregaToCalendar('token', { ...entrega, fechaLimite: undefined })
    expect(deleteEvent).toHaveBeenCalledWith('token', 'cal-1', 'entrega-event')
  })

  it('deletes every calendar event tied to an entrega', async () => {
    vi.mocked(loadCalendarConfig).mockResolvedValue({
      schema: 1,
      rev: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      calendarId: 'cal-1',
    })
    vi.mocked(listEvents).mockResolvedValue([
      googleEvent({ id: 'event-a' }),
      googleEvent({ id: 'event-b' }),
    ])

    await deleteEntregaFromCalendar('token', 'entrega-1')

    expect(deleteEvent).toHaveBeenCalledTimes(2)
    expect(deleteEvent).toHaveBeenCalledWith('token', 'cal-1', 'event-a')
    expect(deleteEvent).toHaveBeenCalledWith('token', 'cal-1', 'event-b')
  })
})
