import { useParams, Link } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'

export default function ColeccionDetail() {
  const { id } = useParams<{ id: string }>()
  const coleccion = useGalleryStore((s) => s.colecciones.find((c) => c.id === id))
  const obras = useGalleryStore((s) => s.obras.filter((o) => o.coleccionIds.includes(id!)))

  if (!coleccion) {
    return (
      <div className="p-6">
        <p>No encontrada</p>
        <Link to="/colecciones">Volver</Link>
      </div>
    )
  }

  const ordered = coleccion.tipo === 'cuaderno'
    ? obras.sort((a, b) => (a.ordenEnColeccion?.[coleccion.id] ?? 0) - (b.ordenEnColeccion?.[coleccion.id] ?? 0))
    : obras

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{coleccion.nombre} {coleccion.tipo === 'cuaderno' && '· Cuaderno'}</h1>
        <Link to="/colecciones">Volver</Link>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {ordered.map((o) => (
          <Link key={o.id} to={`/obra/${o.id}`} className="bg-[var(--surface)] border border-[var(--border)] rounded overflow-hidden">
            <img src={o.miniatura} className="w-full h-32 object-cover" />
            <div className="p-2 text-sm truncate">{o.titulo || 'Sin título'}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
