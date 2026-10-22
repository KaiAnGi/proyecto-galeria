import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { syncColeccionObra, saveObra } from '../features/gallery/persistence'
import { getToken } from '../features/auth/googleAuth'
import { friendlyError } from '../lib/errors/friendlyError'
import { es } from '../i18n/es'
import { StarSticker } from '../components/Stickers'
import CuteComment from '../components/CuteComment'

export default function ColeccionDetail() {
  const { id } = useParams<{ id: string }>()
  const coleccion = useGalleryStore((s) => s.colecciones.find((c) => c.id === id))
  const obras = useGalleryStore((s) => s.obras.filter((o) => o.coleccionIds.includes(id!)))
  const allObras = useGalleryStore((s) => s.obras)
  const addObraToColeccion = useGalleryStore((s) => s.addObraToColeccion)
  const removeObraFromColeccion = useGalleryStore((s) => s.removeObraFromColeccion)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!coleccion) {
    return (
      <div className="min-h-full p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-[var(--muted)]">{es.collections.notFound}</p>
        <Link to="/colecciones" className="btn btn-soft">
          {es.collections.back}
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
      const token = getToken()
      if (token) {
        await syncColeccionObra(token, coleccion!, obra, true)
        const updated = { ...obra, coleccionIds: [...obra.coleccionIds, id!] }
        await saveObra(token, updated)
      }
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
      const token = getToken()
      if (token) {
        await syncColeccionObra(token, coleccion!, obra, false)
        const updated = { ...obra, coleccionIds: obra.coleccionIds.filter((c) => c !== id) }
        await saveObra(token, updated)
      }
    } catch (e) {
      console.error('Remove work from collection failed', e)
      setError(friendlyError(e, es.errors.unexpected))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 fade-up">
          <StarSticker className="w-8 h-8 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold gradient-text truncate">{coleccion.nombre}</h1>
            <p className="text-sm text-[var(--muted)]">{es.collections.works(obras.length)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value=""
            disabled={busy}
            onChange={(e) => {
              const obraId = e.target.value
              if (obraId) void addObra(obraId)
              e.target.value = ''
            }}
            className="field"
            aria-label={es.collections.addTo}
          >
            <option value="">{es.collections.addTo}...</option>
            {allObras
              .filter((o) => !o.coleccionIds.includes(id!))
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.titulo || es.collections.untitled}
                </option>
              ))}
          </select>
          <Link to="/colecciones" className="btn btn-soft">
            ← Volver
          </Link>
        </div>
      </header>

      {error && (
        <p role="alert" className="text-sm text-[#ff9db1]">
          {error}
        </p>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
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
      </section>
      <CuteComment />
    </div>
  )
}
