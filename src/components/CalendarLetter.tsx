import { useEffect, useMemo, useRef, useState } from 'react'
import { es } from '../i18n/es'
import { HeartSticker, StarSticker } from './Stickers'
import TogetherCounter from './TogetherCounter'
import { useGalleryStore, type CalendarioEvento } from '../features/gallery/store'
import {
  authorBirthday,
  daysTogether,
  isMonthiversary,
  nextMonthiversary,
  partnerBirthday,
  relationshipStartDate,
} from '../features/romance/dates'
import { clearSessionToken, ensureCalendarToken } from '../features/auth/googleAuth'
import { ensureLoaded } from '../features/gallery/persistence'
import {
  createEvent,
  deleteEvent,
  listEvents,
  patchEvent,
} from '../features/googleCalendar/calendarApi'
import { CALENDAR_APP_ID, setupKuromiCalendar } from '../features/googleCalendar/sync'
import {
  addDaysIso,
  eventDates,
  eventStartDate,
  eventTimeLabel,
} from '../features/googleCalendar/mapping'
import type { GoogleCalendarEvent } from '../features/googleCalendar/types'
import { friendlyError, shouldRefreshSession } from '../lib/errors/friendlyError'

type Props = { open: boolean; onClose: () => void }

function describeCalendarError(e: unknown, fallback: string): string {
  if (shouldRefreshSession(e)) clearSessionToken()
  return friendlyError(e, fallback)
}

type DayEventType =
  | 'monthiversary'
  | 'anniversary'
  | 'birthdayPartner'
  | 'birthdayAuthor'
  | 'entrega'
  | 'custom'
  | 'google'
type DayEvent = {
  key: string
  type: DayEventType
  title: string
  detail?: string
  entregaId?: string
  evento?: CalendarioEvento
  googleEvent?: GoogleCalendarEvent
}
type FormMode = 'create' | 'edit'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const UNDO_MS = 7000

function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export default function CalendarLetter({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const tokenRef = useRef<string | null>(null)
  const calendarIdRef = useRef<string | null>(null)
  const pendingRef = useRef<{ event: GoogleCalendarEvent; timeout: ReturnType<typeof setTimeout> } | null>(null)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()))
  const [calendarId, setCalendarId] = useState<string | null>(null)
  const [migrationDone, setMigrationDone] = useState(false)
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [monthKey, setMonthKey] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formDate, setFormDate] = useState(() => isoDate(new Date()))
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<GoogleCalendarEvent | null>(null)
  const [now] = useState(() => new Date())
  const entregas = useGalleryStore((s) => s.entregas)
  const legacyEvents = useGalleryStore((s) => s.calendarioEventos)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function setup() {
      setLoading(true)
      setError(null)
      try {
        const token = await ensureCalendarToken()
        if (cancelled) return
        tokenRef.current = token
        await ensureLoaded(token)
        if (cancelled) return
        const state = useGalleryStore.getState()
        const setup = await setupKuromiCalendar(token, state.calendarioEventos, state.entregas)
        if (cancelled) return
        calendarIdRef.current = setup.calendarId
        setCalendarId(setup.calendarId)
        setMigrationDone(setup.migrated)
        setMonthKey((value) => value + 1)
      } catch (e) {
        if (!cancelled) setError(describeCalendarError(e, es.calendar.loadError))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void setup()
    return () => {
      cancelled = true
    }
  }, [open, reloadKey])

  useEffect(() => {
    if (!open || !calendarId) return
    const token = tokenRef.current
    if (!token) return
    const calendarToken = token
    const id = calendarId
    let cancelled = false
    const first = startOfMonth(viewDate)
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1)

    async function loadMonth() {
      setLoading(true)
      setError(null)
      setGoogleEvents([])
      try {
        const events = await listEvents(calendarToken, id, {
          timeMin: first.toISOString(),
          timeMax: next.toISOString(),
        })
        if (!cancelled) setGoogleEvents(events)
      } catch (e) {
        if (!cancelled) setError(describeCalendarError(e, es.calendar.loadError))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadMonth()
    return () => {
      cancelled = true
    }
  }, [open, calendarId, viewDate, monthKey])

  const monthStart = startOfMonth(viewDate)
  const monthDays = useMemo(() => {
    const year = monthStart.getFullYear()
    const month = monthStart.getMonth()
    const first = monthStart.getDay()
    const offset = first === 0 ? 6 : first - 1
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: Array<{ date: Date; iso: string; inMonth: boolean }> = []
    for (let i = 0; i < offset; i++) {
      const d = new Date(year, month, -offset + i + 1)
      days.push({ date: d, iso: isoDate(d), inMonth: false })
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day)
      days.push({ date: d, iso: isoDate(d), inMonth: true })
    }
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date
      const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
      days.push({ date: d, iso: isoDate(d), inMonth: false })
    }
    return days
  }, [monthStart])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DayEvent[]>()
    const add = (iso: string, ev: DayEvent) => {
      const list = map.get(iso) || []
      list.push(ev)
      map.set(iso, list)
    }

    const syncedEntregaIds = new Set<string>()
    const syncedLegacyIds = new Set<string>()
    const entregaIds = new Set(entregas.map((entrega) => entrega.id))
    for (const event of googleEvents) {
      if (event.id === pendingDelete?.id) continue
      const linkedEntregaId = event.extendedProperties?.private?.entregaId
      const entregaId =
        linkedEntregaId && entregaIds.has(linkedEntregaId) ? linkedEntregaId : undefined
      const legacyId = event.extendedProperties?.private?.legacyDriveId
      if (entregaId) syncedEntregaIds.add(entregaId)
      if (legacyId) syncedLegacyIds.add(legacyId)
      const time = eventTimeLabel(event)
      const description = event.description?.split('\n')[0]
      const detail = [time, description].filter(Boolean).join(' · ') || undefined
      for (const date of eventDates(event)) {
        add(date, {
          key: 'google-' + event.id + '-' + date,
          type: entregaId ? 'entrega' : 'google',
          title: event.summary || es.calendar.untitled,
          detail,
          entregaId,
          googleEvent: event,
        })
      }
    }

    const year = viewDate.getFullYear()
    const partner = partnerBirthday(year)
    add(isoDate(partner), {
      key: 'bday-p-' + isoDate(partner),
      type: 'birthdayPartner',
      title: es.calendar.type.birthdayPartner,
    })
    const author = authorBirthday(year)
    add(isoDate(author), {
      key: 'bday-a-' + isoDate(author),
      type: 'birthdayAuthor',
      title: es.calendar.type.birthdayAuthor,
    })
    const start = relationshipStartDate()
    const anniversary = new Date(year, start.getMonth(), start.getDate())
    add(isoDate(anniversary), {
      key: 'anniv-' + year,
      type: 'anniversary',
      title: es.calendar.type.anniversary,
    })
    if (isMonthiversary(now)) {
      add(isoDate(now), {
        key: 'month-' + year + '-' + now.getMonth(),
        type: 'monthiversary',
        title: es.calendar.type.monthiversary,
        detail: es.romance.daysTogether(daysTogether(now)),
      })
    } else {
      const next = nextMonthiversary(now)
      if (next.getFullYear() === year && next.getMonth() === now.getMonth()) {
        add(isoDate(next), {
          key: 'month-next-' + isoDate(next),
          type: 'monthiversary',
          title: es.calendar.type.monthiversary,
        })
      }
    }

    for (const entrega of entregas) {
      if (!entrega.fechaLimite || syncedEntregaIds.has(entrega.id)) continue
      add(entrega.fechaLimite, {
        key: 'entrega-' + entrega.id,
        type: 'entrega',
        title: entrega.titulo,
        detail: entrega.asignatura,
        entregaId: entrega.id,
      })
    }

    if (!migrationDone) {
      for (const event of legacyEvents) {
        if (syncedLegacyIds.has(event.id)) continue
        add(event.fecha, {
          key: 'legacy-' + event.id,
          type: 'custom',
          title: event.titulo,
          detail: event.notas,
          evento: event,
        })
      }
    }

    for (const [key, list] of map) {
      map.set(key, list.slice(0, 5))
    }
    return map
  }, [entregas, googleEvents, legacyEvents, migrationDone, now, pendingDelete, viewDate])

  const selectedEvents = eventsByDate.get(selectedDate) || []
  const monthLabel = viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  function resetForm() {
    setFormOpen(false)
    setEditingId(null)
    setTitle('')
    setNotes('')
  }

  function startCreate() {
    setFormMode('create')
    setEditingId(null)
    setFormDate(selectedDate)
    setTitle('')
    setNotes('')
    setFormOpen(true)
  }

  function startEdit(event: DayEvent) {
    const googleEvent = event.googleEvent
    if (!googleEvent || event.entregaId) return
    setFormMode('edit')
    setEditingId(googleEvent.id)
    setFormDate(eventStartDate(googleEvent) || selectedDate)
    setTitle(googleEvent.summary || '')
    setNotes(googleEvent.description || '')
    setFormOpen(true)
  }

  async function handleSave() {
    if (!title.trim() || !calendarId) return
    setSaving(true)
    setError(null)
    try {
      const token = await ensureCalendarToken()
      tokenRef.current = token
      const input = {
        summary: title.trim(),
        description: notes.trim() || undefined,
        start: { date: formDate },
        end: { date: addDaysIso(formDate, 1) },
      }

      if (formMode === 'edit' && editingId) {
        const updated = await patchEvent(token, calendarId, editingId, input)
        setGoogleEvents((current) =>
          current.map((event) => (event.id === updated.id ? updated : event)),
        )
      } else {
        const created = await createEvent(token, calendarId, {
          ...input,
          extendedProperties: { private: { app: CALENDAR_APP_ID } },
        })
        setGoogleEvents((current) => [...current, created])
      }

      setSelectedDate(formDate)
      resetForm()
    } catch (e) {
      setError(describeCalendarError(e, es.calendar.saveError))
    } finally {
      setSaving(false)
    }
  }

  async function commitDelete(event: GoogleCalendarEvent) {
    try {
      const token = tokenRef.current || (await ensureCalendarToken())
      tokenRef.current = token
      if (calendarIdRef.current) {
        await deleteEvent(token, calendarIdRef.current, event.id)
      }
    } catch (e) {
      console.warn('Calendar delete failed', e)
    }
  }

  useEffect(
    () => () => {
      const pending = pendingRef.current
      if (pending) {
        clearTimeout(pending.timeout)
        void commitDelete(pending.event)
      }
      pendingRef.current = null
    },
    [],
  )

  function clearPending(commit: boolean) {
    const pending = pendingRef.current
    if (!pending) return
    clearTimeout(pending.timeout)
    pendingRef.current = null
    setPendingDelete(null)
    if (commit) void commitDelete(pending.event)
  }

  function requestDelete(event: DayEvent) {
    if (!event.googleEvent || event.entregaId) return
    clearPending(true)
    const googleEvent = event.googleEvent
    setGoogleEvents((current) => current.filter((item) => item.id !== googleEvent.id))
    const timeout = setTimeout(() => {
      pendingRef.current = null
      setPendingDelete(null)
      void commitDelete(googleEvent)
    }, UNDO_MS)
    pendingRef.current = { event: googleEvent, timeout }
    setPendingDelete(googleEvent)
  }

  function undoDelete() {
    const pending = pendingRef.current
    if (!pending) return
    clearTimeout(pending.timeout)
    pendingRef.current = null
    setGoogleEvents((current) => [...current, pending.event])
    setPendingDelete(null)
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1)
    setViewDate(next)
    setSelectedDate(isoDate(next))
    resetForm()
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-title"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex h-[100dvh] max-h-[100dvh] items-center justify-center overflow-hidden bg-black/75 p-2 backdrop-blur-sm sm:p-4"
    >
      <article
        onClick={(e) => e.stopPropagation()}
        className="love-letter letter-open relative flex h-full min-h-0 w-full max-w-5xl flex-col px-3 py-3 text-[#4a2438] max-h-full sm:px-6 sm:py-5 md:max-h-[52rem] lg:max-w-6xl lg:px-8"
      >
        <HeartSticker className="absolute -right-3 -top-4 hidden h-10 w-10 sticker-shadow sm:block" />
        <StarSticker className="absolute -left-3 bottom-6 hidden h-6 w-6 opacity-80 sm:block" />

        <header className="flex shrink-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="hidden text-[10px] uppercase tracking-[0.25em] text-[#a1567b] sm:block">
              {es.calendar.kicker}
            </p>
            <h2
              id="calendar-title"
              className="truncate font-display text-xl font-bold text-[#7b2f55] sm:mt-1 sm:text-3xl lg:text-4xl"
            >
              {es.calendar.title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn btn-soft shrink-0 px-3"
          >
            {es.romance.letter.close}
          </button>
        </header>

        <div className="mt-1 shrink-0 sm:mt-2">
          <TogetherCounter />
        </div>

        {error && (
          <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#fde7ee] px-3 py-2 text-xs text-[#8a3158] sm:text-sm">
            <p className="min-w-0 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="btn btn-soft shrink-0 px-3"
            >
              {es.calendar.retry}
            </button>
          </div>
        )}

        {loading && (
          <p className="mt-1 shrink-0 text-[10px] text-[#a1567b] sm:text-xs">
            {es.calendar.loading}
          </p>
        )}

        {pendingDelete && (
          <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#fff3d6] px-3 py-2 text-xs sm:text-sm">
            <p className="min-w-0 flex-1">{es.calendar.deleted}</p>
            <button
              type="button"
              onClick={undoDelete}
              className="btn btn-soft shrink-0 px-3"
            >
              {es.calendar.undo}
            </button>
          </div>
        )}

        <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 md:mt-4 md:flex-row md:gap-4">
          <section
            className={
              'flex min-h-0 flex-[1.15] flex-col ' + (formOpen ? 'hidden md:flex' : '')
            }
          >
            <div className="flex shrink-0 items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="btn btn-soft shrink-0 px-2 text-xs sm:px-3 sm:text-sm"
              >
                {es.calendar.monthPrev}
              </button>
              <p className="min-w-0 truncate px-1 text-center font-display text-base capitalize sm:text-lg">
                {monthLabel}
              </p>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="btn btn-soft shrink-0 px-2 text-xs sm:px-3 sm:text-sm"
              >
                {es.calendar.monthNext}
              </button>
            </div>

            <div className="mt-1 grid shrink-0 grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-widest text-[#a1567b] sm:gap-2 sm:text-xs">
              {WEEKDAYS.map((weekday) => (
                <div key={weekday} className="py-0.5 sm:py-1">
                  {weekday}
                </div>
              ))}
            </div>

            <div className="mt-1 grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-1 sm:gap-2">
              {monthDays.map((day) => {
                const events = eventsByDate.get(day.iso) || []
                const isSelected = selectedDate === day.iso
                const isToday = day.iso === isoDate(now)
                return (
                  <button
                    key={day.iso}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day.iso)
                      resetForm()
                    }}
                    className={
                      'relative flex min-h-0 min-w-0 flex-col items-center justify-start overflow-hidden rounded-lg px-0.5 py-0.5 text-xs transition sm:rounded-2xl sm:px-1 sm:py-1 sm:text-sm ' +
                      (isSelected
                        ? 'bg-white/80 shadow-md ring-1 ring-[#f7a8c3]'
                        : 'bg-white/40 hover:bg-white/70') +
                      ' ' +
                      (day.inMonth ? '' : 'opacity-50')
                    }
                  >
                    <span
                      className={
                        'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] sm:mt-1 sm:h-6 sm:w-6 sm:text-sm ' +
                        (isToday ? 'bg-[#f7a8c3]/60 font-semibold' : '')
                      }
                    >
                      {day.date.getDate()}
                    </span>
                    <div className="mt-0.5 flex flex-wrap justify-center gap-0.5 sm:mt-1 sm:gap-1">
                      {events.slice(0, 3).map((event) => (
                        <span
                          key={event.key}
                          className={
                            'h-1 w-1 rounded-full sm:h-1.5 sm:w-1.5 ' +
                            (event.type === 'entrega'
                              ? 'bg-[#7b9bff]'
                              : event.type === 'google'
                                ? 'bg-[#a78bfa]'
                                : event.type === 'custom'
                                  ? 'bg-[#a78bfa]'
                                  : 'bg-[#f59e0b]')
                          }
                        />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl bg-white/60 p-2 shadow-inner sm:rounded-3xl sm:p-4 md:w-[45%] md:flex-none">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <p className="min-w-0 truncate font-display text-sm text-[#7b2f55] sm:text-lg">
                {es.calendar.events} -{' '}
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <button
                type="button"
                onClick={() => (formOpen && formMode === 'create' ? resetForm() : startCreate())}
                className="btn btn-accent shrink-0 px-2 text-xs sm:px-3 sm:text-sm"
              >
                {es.calendar.addEvent}
              </button>
            </div>

            {formOpen ? (
              <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5">
                <p className="shrink-0 text-sm font-medium text-[#7b2f55]">
                  {formMode === 'edit' ? es.calendar.editEvent : es.calendar.addTitle}
                </p>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={es.calendar.eventTitlePlaceholder}
                  className="w-full shrink-0 rounded-2xl border border-[#f3c9d8] bg-white/80 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f7a8c3]"
                />
                <label className="shrink-0 text-xs text-[#a1567b]">
                  {es.calendar.eventDate}
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-[#f3c9d8] bg-white/80 px-3 py-1.5 text-sm text-[#4a2438] focus:outline-none focus:ring-2 focus:ring-[#f7a8c3]"
                  />
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={es.calendar.eventNotesPlaceholder}
                  className="min-h-0 w-full flex-1 resize-none rounded-2xl border border-[#f3c9d8] bg-white/80 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f7a8c3]"
                />
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !title.trim() || !calendarId}
                    className="btn btn-primary px-3 text-xs sm:text-sm"
                  >
                    {saving ? es.app.saving : es.calendar.save}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-soft px-3 text-xs sm:text-sm"
                  >
                    {es.calendar.cancel}
                  </button>
                </div>
                <p className="hidden shrink-0 text-[10px] text-[#a1567b]/80 sm:block">
                  {es.calendar.noteCalendar}
                </p>
              </div>
            ) : (
              <div className="mt-2 grid min-h-0 flex-1 grid-cols-2 content-start gap-1.5 overflow-hidden sm:gap-2">
                {selectedEvents.length === 0 && (
                  <p className="col-span-2 text-sm text-[#a1567b]">{es.calendar.noEvents}</p>
                )}
                {selectedEvents.map((event) => (
                  <div
                    key={event.key}
                    className="flex min-w-0 flex-col rounded-xl bg-white/70 px-2 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2"
                  >
                    <p className="truncate text-xs font-medium sm:text-sm">{event.title}</p>
                    <p className="truncate text-[10px] text-[#a1567b] sm:text-xs">
                      {es.calendar.type[event.type]}
                      {event.detail ? ' - ' + event.detail : ''}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1 text-[10px] sm:text-xs">
                      {event.type === 'entrega' && event.entregaId && (
                        <a
                          href={'#/entrega/' + event.entregaId}
                          className="text-[#7b2f55] underline"
                        >
                          {es.entregas.openDetail}
                        </a>
                      )}
                      {event.googleEvent?.htmlLink && !event.entregaId && (
                        <a
                          href={event.googleEvent.htmlLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#7b2f55] underline"
                        >
                          {es.calendar.openInGoogle}
                        </a>
                      )}
                      {event.googleEvent && !event.entregaId && (
                        <button
                          type="button"
                          onClick={() => startEdit(event)}
                          className="text-[#a1567b] underline"
                        >
                          {es.calendar.edit}
                        </button>
                      )}
                      {event.googleEvent && !event.entregaId && (
                        <button
                          type="button"
                          onClick={() => requestDelete(event)}
                          className="text-[#a1567b] underline"
                        >
                          {es.calendar.delete}
                        </button>
                      )}
                      {event.type === 'custom' && event.evento && (
                        <span className="text-[#a1567b]">{es.calendar.legacyEvent}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </article>
    </div>
  )
}
