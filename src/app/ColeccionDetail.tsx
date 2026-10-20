import { useParams, Link } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { es } from '../i18n/es'
import { StarSticker } from '../components/Stickers'

export default function ColeccionDetail() {
  const { id } = useParams<{ id: string }>()
  const coleccion = useGalleryStore((s) => s.colecciones.find((c) => c.id === id))
  const obras = useGalleryStore((s) => s.obras.filter((o) => o.coleccionIds.includes(id!)))

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

  const ordered =
    coleccion.tipo === 'cuaderno'
      ? obras.sort((a, b) => (a.ordenEnColeccion?.[coleccion.id] ?? 0) - (b.ordenEnColeccion?.[coleccion.id] ?? 0))
      : obras

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold gradient-text truncate fade-up">
          {coleccion.nombre}
          {coleccion.tipo === 'cuaderno' && ` · ${es.collections.notebook}`}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/" className="btn btn-soft">
            ← Volver
          </Link>
        </div>
      </header>

      {ordered.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 py-10">
          <StarSticker className="w-14 h-14 sticker-float sticker-shadow pop-in" />
          <p className="text-sm text-[var(--muted)] max-w-xs">{es.collections.emptyWorks}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {ordered.map((o, i) => (
            <Link
              key={o.id}
              to={`/obra/${o.id}`}
              className="card overflow-hidden fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <div className="sticker-frame m-2 mb-0">
                <img src={o.miniatura} alt="" className="w-full h-32 object-cover" />
              </div>
              <div className="p-3 text-sm font-medium truncate">{o.titulo || es.collections.untitled}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
