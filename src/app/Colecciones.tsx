import { useState } from 'react'
import { useGalleryStore } from '../features/gallery/store'
import { Link } from 'react-router-dom'
import { ulid } from 'ulidx'

export default function Colecciones() {
  const colecciones = useGalleryStore((s) => s.colecciones)
  const addColeccion = useGalleryStore((s) => s.addColeccion)
  const [name, setName] = useState('')
  const [tipo, setTipo] = useState<'general' | 'cuaderno' | 'clase'>('general')

  function crear() {
    if (!name.trim()) return
    addColeccion({
      schema: 1,
      id: ulid(),
      rev: 1,
      updatedAt: new Date().toISOString(),
      nombre: name.trim(),
      tipo,
      orden: colecciones.length,
    })
    setName('')
  }

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Colecciones</h1>
        <Link to="/galeria" className="text-sm text-[var(--muted)]">Volver</Link>
      </header>

      <div className="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] flex flex-wrap items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as any)}
          className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
        >
          <option value="general">General</option>
          <option value="cuaderno">Cuaderno</option>
          <option value="clase">Clase</option>
        </select>
        <button onClick={crear} className="min-h-[44px] px-4 rounded-lg bg-[var(--primary)]">Crear</button>
      </div>

      <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {colecciones.map((c) => (
          <Link key={c.id} to={`/coleccion/${c.id}`} className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
            <h2 className="font-medium">{c.nombre}</h2>
            <p className="text-sm text-[var(--muted)] capitalize">{c.tipo}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
