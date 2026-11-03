import { useEffect, useMemo, useRef, useState } from 'react'
import { es } from '../i18n/es'
import { HeartSticker, StarSticker } from './Stickers'
import { useGalleryStore, type CalendarioEvento } from '../features/gallery/store'
import { authorBirthday, daysTogether, isMonthiversary, nextMonthiversary, partnerBirthday, relationshipStartDate } from '../features/romance/dates'
import { saveCalendarioEvento, trashCalendarioEvento } from '../features/gallery/persistence'
import { ensureToken } from '../features/auth/googleAuth'
import { queueToast } from './Toasts'
import { ulid } from 'ulid'

type Props = {
  open: boolean
  onClose: () => void
}

type DayEvent = {
  key: string
  type: 'monthiversary' | 'anniversary' | 'birthdayPartner' | 'birthdayAuthor' | 'entrega' | 'custom'
  title: string
  detail?: string
  entregaId?: string
  evento?: CalendarioEvento
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return ${y}--
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export default function CalendarLetter({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()))
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [now] = useState(() => new Date())

  const entregas = useGalleryStore((s) => s.entregas)
  const eventos = useGalleryStore((s) => s.calendarioEventos)
  const addEvent = useGalleryStore((s) => s.addCalendarioEvento)
  const removeEvent = useGalleryStore((s) => s.removeCalendarioEvento)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  const monthStart = startOfMonth(viewDate)
  const monthDays = useMemo(() => {
    const year = monthStart.getFullYear()
    const month = monthStart.getMonth()
    const firstDay = monthStart.getDay()
    const offset = firstDay === 0 ? 6 : firstDay - 1
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

    const year = now.getFullYear()
    const pb = partnerBirthday()
    add(isoDate(pb), { key: day-p-, type: 'birthdayPartner', title: es.calendar.type.birthdayPartner })
    const ab = authorBirthday(year)
    add(isoDate(ab), { key: day-a-, type: 'birthdayAuthor', title: es.calendar.type.birthdayAuthor })

    const start = relationshipStartDate()
    const anniv = new Date(year, start.getMonth(), start.getDate())
    add(isoDate(anniv), { key: nniv-, type: 'anniversary', title: es.calendar.type.anniversary })
    if (isMonthiversary(now)) {
      const key = month--
      add(isoDate(now), { key, type: 'monthiversary', title: es.calendar.type.monthiversary, detail: es.romance.daysTogether(daysTogether(now)) })
    } else {
      const nm = nextMonthiversary(now)
      if (nm.getFullYear() === year && nm.getMonth() === now.getMonth()) {
        add(isoDate(nm), { key: month-next-, type: 'monthiversary', title: es.calendar.type.monthiversary })
      }
    }

    for (const ent of entregas) {
      if (!ent.fechaLimite) continue
      add(ent.fechaLimite, { key: ent-, type: 'entrega', title: ent.titulo, detail: ent.asignatura, entregaId: ent.id })
    }

    for (const ev of eventos) {
      add(ev.fecha, { key: custom-, type: 'custom', title: ev.titulo, detail: ev.notas, evento: ev })
    }

    for (const [k, list] of map) {
      map.set(k, list.slice(0, 4))
    }
    return map
  }, [entregas, eventos, now])

  const selectedEvents = eventsByDate.get(selectedDate) || []

  async function handleAdd() {
    if (!title.trim()) return
    setSaving(true)
    try {
      const token = await ensureToken()
      const id = ulid()
      const nowIso = new Date().toISOString()
      const ev: CalendarioEvento = {
        schema: 1,
        id,
        rev: 1,
        updatedAt: nowIso,
        titulo: title.trim(),
        fecha: selectedDate,
        notas: notes.trim() || undefined,
        createdAt: nowIso,
      }
      addEvent(ev)
      await saveCalendarioEvento(token, ev)
      setTitle('')
      setNotes('')
      setAdding(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ev: CalendarioEvento) {
    try {
      const token = await ensureToken()
      removeEvent(ev.id)
      await trashCalendarioEvento(token, ev)
    } catch (e) {
      console.error(e)
    }
  }

  if (!open) return null

  const monthLabel = viewDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-title"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-6"
    >
      <article
        onClick={(event) => event.stopPropagation()}
        className="love-letter letter-open relative my-auto w-full max-w-2xl px-5 py-7 text-[#4a2438] sm:px-10 sm:py-10"
      >
        <HeartSticker className="absolute -right-3 -top-4 h-10 w-10 sticker-shadow" />
        <StarSticker className="absolute -left-3 bottom-6 h-6 w-6 opacity-80" />
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#a1567b]">{es.calendar.kicker}</p>
            <h2 id="calendar-title" className="mt-1 font-display text-3xl font-bold text-[#7b2f55] sm:text-4xl">
              {es.calendar.title}
            </h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="btn btn-soft">
            {es.romance.letter.close}
          </button>
        </header>

        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="btn btn-soft px-3">
            {es.calendar.monthPrev}
          </button>
          <p className="font-display text-lg capitalize">{monthLabel}</p>
          <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="btn btn-soft px-3">
            {es.calendar.monthNext}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-widest text-[#a1567b] sm:gap-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1">{w}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1 sm:gap-2">
          {monthDays.map((day) => {
            const evs = eventsByDate.get(day.iso) || []
            const isSelected = selectedDate === day.iso
            const isToday = day.iso === isoDate(now)
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => { setSelectedDate(day.iso); setAdding(false) }}
                className={elative flex min-h-[3.25rem] flex-col items-center justify-start rounded-2xl px-1 py-1 text-sm transition sm:min-h-[4rem]  }
              >
                <span className={mt-1 flex h-6 w-6 items-center justify-center rounded-full }>{day.date.getDate()}</span>
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  {evs.slice(0, 3).map((ev) => (
                    <span key={ev.key} className={h-1.5 w-1.5 rounded-full } />
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        <section className="mt-6 rounded-3xl bg-white/60 p-4 shadow-inner sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg text-[#7b2f55]">
              {es.calendar.events} · {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <button type="button" onClick={() => setAdding((v) => !v)} className="btn btn-accent">
              {es.calendar.addEvent}
            </button>
          </div>

          {adding && (
            <div className="mt-3 flex flex-col gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={es.calendar.eventTitlePlaceholder} className="w-full rounded-2xl border border-[#f3c9d8] bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f7a8c3]" />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={es.calendar.eventNotesPlaceholder} rows={2} className="w-full rounded-2xl border border-[#f3c9d8] bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f7a8c3]" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleAdd} disabled={saving || !title.trim()} className="btn btn-primary">{saving ? es.app.saving : es.calendar.save}</button>
                <button type="button" onClick={() => setAdding(false)} className="btn btn-soft">{es.calendar.cancel}</button>
              </div>
              <p className="text-xs text-[#a1567b]/80">{es.calendar.noteDrive}</p>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {selectedEvents.length === 0 && <p className="text-sm text-[#a1567b]">{es.calendar.noEvents}</p>}
            {selectedEvents.map((ev) => (
              <div key={ev.key} className="flex items-start justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2">
                <div>
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-xs text-[#a1567b]">{es.calendar.type[ev.type]}{ev.detail ?  ·  : ''}</p>
                  {ev.type === 'entrega' && ev.entregaId && (
                    <a href={#/entrega/} className="mt-1 inline-block text-xs text-[#7b2f55] underline">{es.entregas.openDetail}</a>
                  )}
                </div>
                {ev.type === 'custom' && ev.evento && (
                  <button type="button" onClick={() => handleDelete(ev.evento!)} className="text-xs text-[#a1567b] underline">{es.calendar.delete}</button>
                )}
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  )
}
