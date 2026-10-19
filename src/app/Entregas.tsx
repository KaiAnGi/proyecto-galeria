import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ulid } from 'ulidx'
import { useGalleryStore } from '../features/gallery/store'
import type { Entrega } from '../features/gallery/store'
import { saveEntrega, trashEntrega, ensureLoaded } from '../features/gallery/persistence'
import { getToken } from '../features/auth/googleAuth'
import { es } from '../i18n/es'

type Estado = Entrega['estado']

function daysUntil(fecha: string): number | null {
  const due = new Date(`${fecha}T23:59:59`)
  if (Number.isNaN(due.getTime())) return null
  const now = new Date()
  const diff = due.getTime() - now.getTime()
  return Math.ceil(diff / 86400000)
}

function dueLabel(fecha?: string): string | null {
  if (!fecha) return null
  const days = daysUntil(fecha)
  if (days === null) return null
  if (days < 0) return es.entregas.overdue
  if (days === 0) return es.entregas.dueToday
  return es.entregas.daysLeft(days)
}

export default function Entregas() {
  const entregas = useGalleryStore((s) => s.entregas)
  const obras = useGalleryStore((s) => s.obras)
  const addEntrega = useGalleryStore((s) => s.addEntrega)
  const updateEntrega = useGalleryStore((s) => s.updateEntrega)
  const removeEntrega = useGalleryStore((s) => s.removeEntrega)

  const [titulo, setTitulo] = useState('')
  const [asignatura, setAsignatura] = useState('')
  const [fechaLimite, setFechaLimite] = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) return
    ensureLoaded(token).catch(() => undefined)
  }, [])

  function persist(entrega: Entrega) {
    const token = getToken()
    if (token) saveEntrega(token, entrega).catch(() => undefined)
  }

  function crear() {
    const now = new Date().toISOString()
    const entrega: Entrega = {
      schema: 1,
      id: ulid(),
      rev: 1,
      updatedAt: now,
      titulo: titulo.trim() || es.entregas.emptyTitle,
      asignatura: asignatura.trim() || undefined,
      fechaLimite: fechaLimite || undefined,
      estado: 'pendiente',
      obraIds: [],
    }
    addEntrega(entrega)
    persist(entrega)
    setTitulo('')
    setAsignatura('')
    setFechaLimite('')
  }

  function patch(id: string, changes: Partial<Entrega>) {
    updateEntrega(id, changes)
    const actual = useGalleryStore.getState().entregas.find((e) => e.id === id)
    if (actual) persist(actual)
  }

  function handleTrash(entrega: Entrega) {
    if (!confirm(es.entregas.deleteConfirm)) return
    removeEntrega(entrega.id)
    const token = getToken()
    if (token) trashEntrega(token, entrega).catch(() => undefined)
  }

  function linkObra(entrega: Entrega, obraId: string) {
    if (!obraId || entrega.obraIds.includes(obraId)) return
    patch(entrega.id, { obraIds: [...entrega.obraIds, obraId] })
  }

  function unlinkObra(entrega: Entrega, obraId: string) {
    patch(entrega.id, { obraIds: entrega.obraIds.filter((x) => x !== obraId) })
  }

  const sorted = [...entregas].sort((a, b) => (a.fechaLimite ?? '9999').localeCompare(b.fechaLimite ?? '9999'))

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{es.entregas.title}</h1>
        <Link to="/" className="text-sm text-[var(--muted)] min-h-[44px] flex items-center px-2">
          {es.obra.back}
        </Link>
      </header>

      <div className="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] flex flex-wrap items-center gap-3">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={es.entregas.titlePlaceholder}
          className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] grow"
        />
        <input
          value={asignatura}
          onChange={(e) => setAsignatura(e.target.value)}
          placeholder={es.entregas.subject}
          className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
        />
        <input
          type="date"
          value={fechaLimite}
          onChange={(e) => setFechaLimite(e.target.value)}
          aria-label={es.entregas.due}
          className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
        />
        <button onClick={crear} className="min-h-[44px] px-4 rounded-lg bg-[var(--primary)] text-[var(--text)]">
          {es.entregas.add}
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-[var(--muted)]">{es.entregas.noEntregas}</p>
      ) : (
        <section className="flex flex-col gap-4">
          {sorted.map((entrega) => {
            const label = dueLabel(entrega.fechaLimite)
            const unlinked = obras.filter((o) => !entrega.obraIds.includes(o.id))
            return (
              <article key={entrega.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{entrega.titulo}</h2>
                    <p className="text-sm text-[var(--muted)]">
                      {entrega.asignatura ? `${entrega.asignatura} · ` : ''}
                      {entrega.fechaLimite ? `${entrega.fechaLimite}` : ''}
                      {label ? ` · ${label}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={entrega.estado}
                      onChange={(e) => patch(entrega.id, { estado: e.target.value as Estado })}
                      aria-label={es.entregas.statusLabel}
                      className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
                    >
                      <option value="pendiente">{es.entregas.estado.pendiente}</option>
                      <option value="en_curso">{es.entregas.estado.en_curso}</option>
                      <option value="entregada">{es.entregas.estado.entregada}</option>
                    </select>
                    <button
                      onClick={() => handleTrash(entrega)}
                      className="min-h-[44px] px-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-red-300"
                    >
                      {es.entregas.trash}
                    </button>
                  </div>
                </div>

                <div className="text-sm">
                  <p className="font-medium mb-1">{es.entregas.linkedWorks}</p>
                  {entrega.obraIds.length === 0 ? (
                    <p className="text-[var(--muted)]">{es.entregas.noLinkedWorks}</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {entrega.obraIds.map((obraId) => {
                        const obra = obras.find((o) => o.id === obraId)
                        if (!obra) return null
                        return (
                          <li key={obraId} className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1">
                            <Link to={`/obra/${obra.id}`} className="min-h-[44px] flex items-center">
                              {obra.titulo}
                            </Link>
                            <button
                              onClick={() => unlinkObra(entrega, obraId)}
                              aria-label={es.entregas.unlink}
                              className="min-h-[44px] px-2 text-[var(--muted)]"
                            >
                              ✕
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {unlinked.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => linkObra(entrega, e.target.value)}
                      aria-label={es.entregas.linkWork}
                      className="mt-2 min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
                    >
                      <option value="">{es.entregas.linkWork}</option>
                      {unlinked.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.titulo}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
