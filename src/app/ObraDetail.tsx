import { useParams, Link } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'

export default function ObraDetail() {
  const { id } = useParams<{ id: string }>()
  const obra = useGalleryStore((s) => (id ? s.obras.find((o) => o.id === id) : undefined))

  if (!obra) {
    return (
      <div className="min-h-full p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-[var(--muted)]">No se ha encontrado la obra.</p>
        <Link to="/galeria" className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--surface)]">
          Volver a Mis obras
        </Link>
      </div>
    )
  }

  const archivo = obra.archivos[0]

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <Link to="/galeria" className="text-sm text-[var(--muted)]">
            ← Volver
          </Link>
          <h1 className="text-2xl font-bold mt-1">{obra.titulo || 'Sin título'}</h1>
          <p className="text-sm text-[var(--muted)]">{obra.fecha} · {obra.estado}</p>
        </div>
      </header>

      <section className="bg-[var(--surface)] rounded-lg overflow-hidden border border-[var(--border)] flex items-center justify-center">
        {archivo ? (
          <img src={obra.miniatura} alt={obra.titulo} className="max-w-full max-h-[80vh] object-contain" />
        ) : (
          <div className="py-16 text-[var(--muted)]">Sin imagen</div>
        )}
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
          <h2 className="text-sm font-medium mb-2">Notas</h2>
          <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{obra.notas || 'Sin notas.'}</p>
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
          <h2 className="text-sm font-medium mb-2">Técnicas</h2>
          <p className="text-sm text-[var(--muted)]">{obra.tecnicas.length ? obra.tecnicas.join(', ') : '-'}</p>
        </div>
      </section>
    </div>
  )
}
