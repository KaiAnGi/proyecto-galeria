import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGalleryStore, type Entrega } from '../features/gallery/store'
import { saveEntrega } from '../features/gallery/persistence'
import { useGalleryData } from '../features/gallery/useGalleryData'
import { enqueueSave } from '../features/gallery/saveQueue'
import { queueEntregaTrash } from '../features/gallery/trashQueue'
import { syncEntregaToCalendar } from '../features/googleCalendar/sync'
import { es } from '../i18n/es'
import { MoonSticker } from '../components/Stickers'
import CuteComment from '../components/CuteComment'

type Estado = Entrega['estado']

export default function EntregaDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { state, error: loadError, retry, hasConnectedBefore } = useGalleryData()
  const entrega = useGalleryStore((s) => s.entregas.find((e) => e.id === id))
  const obras = useGalleryStore((s) => s.obras)
  const updateEntrega = useGalleryStore((s) => s.updateEntrega)

  if (!entrega) {
    return (
      <div className="min-h-full p-6 flex flex-col items-center justify-center gap-4 text-center">
        {state === 'loading' ? (
          <p className="text-[var(--muted)]">{es.app.loading}</p>
        ) : state === 'error' ? (
          <>
            <p className="text-[var(--accent-soft)]">{loadError ?? es.gallery.loadError}</p>
            <button type="button" onClick={retry} className="btn btn-soft">
              {es.gallery.retryLoad}
            </button>
          </>
        ) : state === 'idle' && hasConnectedBefore ? (
          <p className="text-[var(--muted)]">{es.gallery.reconnectPrompt}</p>
        ) : (
          <p className="text-[var(--muted)]">{es.entregas.notFound}</p>
        )}
        <Link to="/entregas" className="btn btn-soft">
          ← {es.entregas.back}
        </Link>
      </div>
    )
  }

  function persist(updated: Entrega) {
    void enqueueSave(async (token) => {
      await saveEntrega(token, updated)
      await syncEntregaToCalendar(token, updated).catch((error) => {
        console.warn('Calendar sync failed', error)
      })
    }).catch(() => undefined)
  }

  function patch(changes: Partial<Entrega>) {
    if (!entrega) return
    updateEntrega(entrega.id, changes)
    const actual = useGalleryStore.getState().entregas.find((e) => e.id === entrega.id)
    if (actual) persist(actual)
  }

  function handleTrash() {
    if (!entrega) return
    if (!window.confirm(es.entregas.deleteConfirm)) return
    queueEntregaTrash(entrega)
    navigate('/entregas')
  }

  function linkObra(obraId: string) {
    if (!entrega || !obraId || entrega.obraIds.includes(obraId)) return
    patch({ obraIds: [...entrega.obraIds, obraId] })
  }

  function unlinkObra(obraId: string) {
    if (!entrega) return
    patch({ obraIds: entrega.obraIds.filter((x) => x !== obraId) })
  }

  const unlinked = obras.filter((o) => !entrega.obraIds.includes(o.id))

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <MoonSticker className="hidden sm:block w-11 h-11 shrink-0 sticker-shadow" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{es.entregas.title}</p>
            <input
              aria-label={es.entregas.titlePlaceholder}
              defaultValue={entrega.titulo}
              onBlur={(event) => patch({ titulo: event.target.value.trim() || es.entregas.emptyTitle })}
              placeholder={es.entregas.emptyTitle}
              className="w-full min-w-0 border-0 bg-transparent p-0 text-2xl font-bold gradient-text outline-none sm:text-3xl"
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" onClick={handleTrash} className="btn btn-danger">
            {es.entregas.trash}
          </button>
          <Link to="/entregas" className="btn btn-soft">
            ← {es.entregas.back}
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-4">
          <label htmlFor="asignatura" className="text-sm font-medium block mb-2">
            {es.entregas.subject}
          </label>
          <input
            id="asignatura"
            defaultValue={entrega.asignatura ?? ''}
            onBlur={(event) => patch({ asignatura: event.target.value.trim() || undefined })}
            className="field w-full"
          />
        </div>
        <div className="panel p-4">
          <label htmlFor="fecha" className="text-sm font-medium block mb-2">
            {es.entregas.due}
          </label>
          <input
            id="fecha"
            type="date"
            defaultValue={entrega.fechaLimite ?? ''}
            onChange={(event) => patch({ fechaLimite: event.target.value || undefined })}
            className="field w-full"
          />
        </div>
        <div className="panel p-4">
          <label htmlFor="estado" className="text-sm font-medium block mb-2">
            {es.entregas.statusLabel}
          </label>
          <select
            id="estado"
            value={entrega.estado}
            onChange={(event) => patch({ estado: event.target.value as Estado })}
            className="field w-full"
          >
            <option value="pendiente">{es.entregas.estado.pendiente}</option>
            <option value="en_curso">{es.entregas.estado.en_curso}</option>
            <option value="entregada">{es.entregas.estado.entregada}</option>
          </select>
        </div>
      </section>

      <section className="panel p-4">
        <label htmlFor="notas" className="text-sm font-medium block mb-2">
          {es.entregas.notes}
        </label>
        <textarea
          id="notas"
          defaultValue={entrega.notas ?? ''}
          onBlur={(event) => patch({ notas: event.target.value || undefined })}
          rows={6}
          className="field w-full resize-y"
        />
      </section>

      <section className="panel p-4 flex flex-col gap-3">
        <h2 className="font-display font-semibold">{es.entregas.linkedWorks}</h2>
        {entrega.obraIds.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{es.entregas.noLinkedWorks}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {entrega.obraIds.map((obraId) => {
              const obra = obras.find((o) => o.id === obraId)
              if (!obra) return null
              return (
                <li
                  key={obraId}
                  className="flex items-center gap-1 bg-[var(--bg)] border border-[var(--border)] rounded-full pl-3 pr-1"
                >
                  <Link to={`/obra/${obra.id}`} className="min-h-[44px] flex items-center">
                    {obra.titulo}
                  </Link>
                  <button
                    type="button"
                    onClick={() => unlinkObra(obraId)}
                    aria-label={es.entregas.unlink}
                    className="btn btn-ghost"
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
            onChange={(event) => linkObra(event.target.value)}
            aria-label={es.entregas.linkWork}
            className="field"
          >
            <option value="">{es.entregas.linkWork}</option>
            {unlinked.map((obra) => (
              <option key={obra.id} value={obra.id}>
                {obra.titulo}
              </option>
            ))}
          </select>
        )}
      </section>

      <CuteComment />
    </div>
  )
}
