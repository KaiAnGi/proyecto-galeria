import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import {
  saveObra,
  saveSecuencia,
  syncColeccionObra,
  syncColeccionSecuencia,
} from '../features/gallery/persistence'
import { useGalleryData } from '../features/gallery/useGalleryData'
import { enqueueSave } from '../features/gallery/saveQueue'
import { queueColeccionTrash } from '../features/gallery/trashQueue'
import { friendlyError } from '../lib/errors/friendlyError'
import { es } from '../i18n/es'
import { StarSticker } from '../components/Stickers'
import CuteComment from '../components/CuteComment'

export default function ColeccionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { state, error: loadError, retry, hasConnectedBefore } = useGalleryData()
  const coleccion = useGalleryStore((s) => s.colecciones.find((c) => c.id === id))
  const allObras = useGalleryStore((s) => s.obras)
  const allSecuencias = useGalleryStore((s) => s.secuencias)
  const obras = allObras.filter((o) => (o.coleccionIds ?? []).includes(id!))
  const animaciones = allSecuencias.filter((a) => (a.coleccionIds ?? []).includes(id!))
  const addObraToColeccion = useGalleryStore((s) => s.addObraToColeccion)
  const removeObraFromColeccion = useGalleryStore((s) => s.removeObraFromColeccion)
  const addSecuenciaToColeccion = useGalleryStore((s) => s.addSecuenciaToColeccion)
  const removeSecuenciaFromColeccion = useGalleryStore((s) => s.removeSecuenciaFromColeccion)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!coleccion) {
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
          <p className="text-[var(--muted)]">{es.collections.notFound}</p>
        )}
        <Link to="/colecciones" className="btn btn-soft">
          ← {es.collections.back}
        </Link>
      </div>
    )
  }

  async function addObra(obraId: string) {
    if (!id) return
    const obra = allObras.find((o) => o.id === obraId)
    if (!obra) return
    setBusy(true)
    setError(null)
    try {
      addObraToColeccion(obraId, id)
      await enqueueSave(async (token) => {
        const latest = useGalleryStore.getState().obras.find((o) => o.id === obraId) ?? obra
        await syncColeccionObra(token, coleccion!, latest, true)
        await saveObra(token, latest)
      })
    } catch (e) {
      console.error('Add work to collection failed', e)
      setError(friendlyError(e, es.errors.unexpected))
    } finally {
      setBusy(false)
    }
  }

  async function removeObra(obraId: string) {
    if (!id) return
    const obra = allObras.find((o) => o.id === obraId)
    if (!obra) return
    setBusy(true)
    setError(null)
    try {
      removeObraFromColeccion(obraId, id)
      await enqueueSave(async (token) => {
        const latest = useGalleryStore.getState().obras.find((o) => o.id === obraId) ?? obra
        await syncColeccionObra(token, coleccion!, latest, false)
        await saveObra(token, latest)
      })
    } catch (e) {
      console.error('Remove work from collection failed', e)
      setError(friendlyError(e, es.errors.unexpected))
    } finally {
      setBusy(false)
    }
  }

  async function addAnimation(secuenciaId: string) {
    if (!id) return
    const secuencia = allSecuencias.find((s) => s.id === secuenciaId)
    if (!secuencia) return
    setBusy(true)
    setError(null)
    try {
      addSecuenciaToColeccion(secuenciaId, id)
      await enqueueSave(async (token) => {
        const latest = useGalleryStore.getState().secuencias.find((s) => s.id === secuenciaId) ?? secuencia
        await syncColeccionSecuencia(token, coleccion!, latest, true)
        await saveSecuencia(token, latest)
      })
    } catch (e) {
      console.error('Add animation to collection failed', e)
      setError(friendlyError(e, es.errors.unexpected))
    } finally {
      setBusy(false)
    }
  }

  async function removeAnimation(secuenciaId: string) {
    if (!id) return
    const secuencia = allSecuencias.find((s) => s.id === secuenciaId)
    if (!secuencia) return
    setBusy(true)
    setError(null)
    try {
      removeSecuenciaFromColeccion(secuenciaId, id)
      await enqueueSave(async (token) => {
        const latest = useGalleryStore.getState().secuencias.find((s) => s.id === secuenciaId) ?? secuencia
        await syncColeccionSecuencia(token, coleccion!, latest, false)
        await saveSecuencia(token, latest)
      })
    } catch (e) {
      console.error('Remove animation from collection failed', e)
      setError(friendlyError(e, es.errors.unexpected))
    } finally {
      setBusy(false)
    }
  }

  function handleTrash() {
    if (!coleccion) return
    if (!window.confirm(es.collections.deleteConfirm)) return
    queueColeccionTrash(coleccion)
    navigate('/colecciones')
  }

  const disponibles = allObras.filter((o) => !(o.coleccionIds ?? []).includes(id!))
  const animacionesDisponibles = allSecuencias.filter((s) => !(s.coleccionIds ?? []).includes(id!))

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 fade-up">
          <StarSticker className="w-8 h-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold gradient-text truncate">{coleccion.nombre}</h1>
            <p className="text-sm text-[var(--muted)]">
              {es.collections.works(obras.length)} · {es.collections.animations(animaciones.length)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value=""
            disabled={busy || state !== 'ready' || disponibles.length === 0}
            onChange={(e) => {
              const obraId = e.target.value
              if (obraId) void addObra(obraId)
              e.target.value = ''
            }}
            className="field"
            aria-label={es.collections.addTo}
          >
            <option value="">{es.collections.addTo}...</option>
            {disponibles.map((o) => (
              <option key={o.id} value={o.id}>
                {o.titulo || es.collections.untitled}
              </option>
            ))}
          </select>
          <select
            value=""
            disabled={busy || state !== 'ready' || animacionesDisponibles.length === 0}
            onChange={(e) => {
              const secuenciaId = e.target.value
              if (secuenciaId) void addAnimation(secuenciaId)
              e.target.value = ''
            }}
            className="field"
            aria-label={es.collections.addAnimation}
          >
            <option value="">{es.collections.addAnimation}...</option>
            {animacionesDisponibles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titulo || es.collections.untitled}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleTrash} className="btn btn-danger shrink-0">
            {es.collections.trash}
          </button>
          <Link to="/colecciones" className="btn btn-soft">
            ← {es.collections.back}
          </Link>
        </div>
      </header>

      {error && (
        <p role="alert" className="text-sm text-[#ff9db1]">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display font-semibold">{es.collections.worksTitle}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {obras.length === 0 ? (
            <div className="col-span-full flex flex-col items-center text-center gap-3 py-10">
              <StarSticker className="w-16 sticker-float sticker-shadow pop-in" />
              <p className="text-sm text-[var(--muted)]">{es.collections.emptyWorks}</p>
            </div>
          ) : (
            obras.map((obra) => (
              <div key={obra.id} className="group panel overflow-hidden">
                <Link to={`/obra/${obra.id}`} className="block">
                  {obra.miniatura ? (
                    <img
                      src={obra.miniatura}
                      alt={obra.titulo}
                      className="w-full aspect-square object-cover group-hover:scale-[1.02] transition-transform"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gradient-to-br from-[var(--panel-2)] to-transparent" />
                  )}
                </Link>
                <div className="p-2 flex items-center justify-between gap-2">
                  <Link to={`/obra/${obra.id}`} className="text-sm truncate">
                    {obra.titulo || es.collections.untitled}
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeObra(obra.id)}
                    className="text-xs text-[var(--muted)] underline min-h-11 px-2"
                  >
                    {es.collections.removeWork}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display font-semibold">{es.collections.animationsTitle}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {animaciones.length === 0 ? (
            <div className="col-span-full flex flex-col items-center text-center gap-3 py-10">
              <StarSticker className="w-16 sticker-float sticker-shadow pop-in" />
              <p className="text-sm text-[var(--muted)]">{es.collections.emptyAnimations}</p>
            </div>
          ) : (
            animaciones.map((secuencia) => (
              <div key={secuencia.id} className="panel overflow-hidden">
                {secuencia.miniatura ? (
                  <img
                    src={secuencia.miniatura}
                    alt={secuencia.titulo}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square bg-gradient-to-br from-[var(--panel-2)] to-transparent" />
                )}
                <div className="p-2 flex items-center justify-between gap-2">
                  <span className="text-sm truncate">{secuencia.titulo || es.collections.untitled}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeAnimation(secuencia.id)}
                    className="text-xs text-[var(--muted)] underline min-h-11 px-2"
                  >
                    {es.collections.removeAnimation}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      <CuteComment />
    </div>
  )
}
