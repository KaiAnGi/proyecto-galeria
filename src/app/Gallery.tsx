import { useState } from 'react'
import { useGalleryStore } from '../features/gallery/store'
import { Link } from 'react-router-dom'

export default function Gallery() {
  const obras = useGalleryStore((s) => s.obras)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis obras</h1>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="min-h-[44px] px-5 py-3 rounded-lg bg-[var(--primary)] text-[var(--text)]"
        >
          Añadir dibujo
        </button>
      </header>

      {showAdd && (
        <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
          <p className="text-sm text-[var(--muted)] mb-3">Funciones de captura/subida llegan en este paso.</p>
          <div className="flex flex-wrap gap-3">
            <label className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center">
              <input type="file" accept="image/*" capture="environment" className="hidden" />
              Fotografiar dibujo
            </label>
            <label className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center">
              <input type="file" accept="image/*" multiple className="hidden" />
              Elegir de la galería
            </label>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {obras.length === 0 ? (
          <p className="col-span-full text-center text-[var(--muted)] py-12">Aquí no hay nada... todavía.</p>
        ) : (
          obras.map((obra) => (
            <Link key={obra.id} to={`/obra/${obra.id}`} className="block bg-[var(--surface)] rounded-lg overflow-hidden border border-[var(--border)]">
              {obra.miniatura ? (
                <img src={obra.miniatura} alt={obra.titulo} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 flex items-center justify-center text-[var(--muted)] text-sm">Sin imagen</div>
              )}
              <div className="p-3">
                <h2 className="text-sm font-medium truncate">{obra.titulo || 'Sin título'}</h2>
                <p className="text-xs text-[var(--muted)] mt-1">{obra.fecha}</p>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  )
}
