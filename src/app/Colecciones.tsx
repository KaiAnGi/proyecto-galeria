import { useState, useEffect } from 'react'
import { useGalleryStore } from '../features/gallery/store'
import { Link } from 'react-router-dom'
import { ulid } from 'ulidx'
import { saveColeccion, ensureLoaded } from '../features/gallery/persistence'
import { getToken } from '../features/auth/googleAuth'
import { es } from '../i18n/es'
import { StarSticker, HeartSticker } from '../components/Stickers'
import { PlusIcon, BinderIcon } from '../components/Icons'

export default function Colecciones() {
  const colecciones = useGalleryStore((s) => s.colecciones)
  const addColeccion = useGalleryStore((s) => s.addColeccion)
  const [name, setName] = useState('')
  const [tipo, setTipo] = useState<'general' | 'cuaderno' | 'clase'>('general')

  useEffect(() => {
    const token = getToken()
    if (!token) return
    ensureLoaded(token).catch(() => undefined)
  }, [])

  function crear() {
    if (!name.trim()) return
    const c = {
      schema: 1 as const,
      id: ulid(),
      rev: 1,
      updatedAt: new Date().toISOString(),
      nombre: name.trim(),
      tipo,
      orden: colecciones.length,
    }
    addColeccion(c)
    const token = getToken()
    if (token) saveColeccion(token, c).catch(() => undefined)
    setName('')
  }

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 fade-up">
          <BinderIcon className="hidden sm:block w-8 h-8 shrink-0 text-[var(--accent-soft)]" />
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text truncate">{es.collections.title}</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0 fade-up">
          <Link to="/" className="btn btn-soft">
            ← Volver
          </Link>
          <Link to="/galeria" className="btn btn-soft">
            {es.collections.back}
          </Link>
        </div>
      </header>

      <div className="panel p-4 flex flex-wrap items-center gap-3 fade-up" style={{ animationDelay: '0.08s' }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={es.collections.namePlaceholder}
          className="field grow min-w-[11rem]"
        />
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as 'general' | 'cuaderno' | 'clase')}
          aria-label={es.collections.tipoLabel}
          className="field"
        >
          <option value="general">{es.collections.tipo.general}</option>
          <option value="cuaderno">{es.collections.tipo.cuaderno}</option>
          <option value="clase">{es.collections.tipo.clase}</option>
        </select>
        <button onClick={crear} className="btn btn-primary">
          <PlusIcon className="w-5 h-5" />
          {es.collections.create}
        </button>
      </div>

      {colecciones.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 py-10 relative">
          <span className="relative inline-block">
            <StarSticker className="w-16 h-16 sticker-float sticker-shadow pop-in" />
            <HeartSticker className="absolute -bottom-2 -right-4 w-7 sticker-float-slow" />
          </span>
          <p className="text-sm text-[var(--muted)] max-w-xs">{es.collections.empty}</p>
        </div>
      ) : (
        <section className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {colecciones.map((c, i) => (
            <Link
              key={c.id}
              to={`/coleccion/${c.id}`}
              className="card p-4 fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <h2 className="font-display font-semibold">{c.nombre}</h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                {es.collections.tipo[c.tipo as keyof typeof es.collections.tipo] ?? c.tipo}
              </p>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
