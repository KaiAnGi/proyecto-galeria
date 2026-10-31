import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { useGalleryData } from '../features/gallery/useGalleryData'
import { queueSecuenciaTrash } from '../features/gallery/trashQueue'
import { sequenceDuration, sortFrames } from '../features/gallery/sequenceFrames'
import type { Secuencia } from '../features/gallery/secuencias'
import { es } from '../i18n/es'
import { BatSticker } from '../components/Stickers'
import { PencilIcon, PlusIcon, TrashIcon } from '../components/Icons'
import CuteComment from '../components/CuteComment'
import NewAnimationPanel from '../components/animations/NewAnimationPanel'

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AnimationCard({ sequence, index }: { sequence: Secuencia; index: number }) {
  const frames = sortFrames(sequence.frames)
  const duration = sequenceDuration(frames, sequence.fps)

  return (
    <article className="card overflow-hidden fade-up" style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <Link to={`/animaciones/${sequence.id}`} className="block focus-visible:outline-none">
        <div className="relative aspect-[4/3] bg-black/30">
          {sequence.miniatura ? (
            <img
              src={sequence.miniatura}
              alt={es.pencil.frameAlt(1)}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--accent-soft)]">
              <PencilIcon className="h-10 w-10" />
            </div>
          )}
          <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-xs text-white">
            {es.pencil.fpsShort(sequence.fps)}
          </span>
        </div>
        <div className="p-3">
          <h2 className="truncate font-display font-semibold">{sequence.titulo}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {es.pencil.cardFrames(frames.length)} · {es.pencil.cardDuration(duration)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{es.pencil.updated(formatDate(sequence.updatedAt))}</p>
        </div>
      </Link>
      <div className="flex justify-end px-2 pb-2">
        <button
          type="button"
          onClick={() => queueSecuenciaTrash(sequence)}
          aria-label={`${es.pencil.deleteAnimation}: ${sequence.titulo}`}
          className="btn btn-soft min-w-11 min-h-11 px-2"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </article>
  )
}

export default function Animaciones() {
  const secuencias = useGalleryStore((state) => state.secuencias)
  const { state, error: loadError, retry, hasConnectedBefore } = useGalleryData()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const ordered = [...secuencias].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 fade-up">
          <PencilIcon className="hidden h-7 w-7 shrink-0 text-[var(--accent-soft)] sm:block" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{es.pencil.kicker}</p>
            <h1 className="truncate text-xl font-bold gradient-text sm:text-2xl">{es.pencil.title}</h1>
          </div>
        </div>
        <Link to="/" className="btn btn-soft shrink-0">
          ← {es.pencil.back}
        </Link>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 fade-up" style={{ animationDelay: '0.06s' }}>
        <p className="text-sm text-[var(--muted)]">{es.pencil.count(secuencias.length)}</p>
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          disabled={state === 'loading'}
          className="btn btn-primary"
        >
          <PlusIcon className="h-5 w-5" />
          {es.pencil.newAnimation}
        </button>
      </div>

      {creating && (
        <NewAnimationPanel
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            navigate(`/animaciones/${id}`)
          }}
        />
      )}

      {state === 'error' && (
        <div className="panel flex flex-col items-center gap-3 p-4 text-center">
          <p className="text-[var(--accent-soft)]">{loadError ?? es.gallery.loadError}</p>
          <button type="button" onClick={retry} className="btn btn-soft">
            {es.gallery.retryLoad}
          </button>
        </div>
      )}

      {state === 'idle' && hasConnectedBefore && (
        <div className="panel p-4 text-center">
          <p className="text-sm text-[var(--muted)]">{es.gallery.reconnectPrompt}</p>
        </div>
      )}

      {state === 'loading' ? (
        <p className="text-sm text-[var(--muted)]">{es.pencil.loading}</p>
      ) : ordered.length === 0 ? (
        <div className="relative flex flex-col items-center gap-3 py-10 text-center">
          <BatSticker className="w-20 sticker-float sticker-shadow pop-in" />
          <p className="font-medium">{es.pencil.empty}</p>
          <p className="max-w-xs text-sm text-[var(--muted)]">{es.pencil.emptySub}</p>
          <button type="button" onClick={() => setCreating(true)} className="btn btn-primary">
            <PlusIcon className="h-5 w-5" />
            {es.pencil.emptyCta}
          </button>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {ordered.map((sequence, index) => (
            <AnimationCard key={sequence.id} sequence={sequence} index={index} />
          ))}
        </section>
      )}
      <CuteComment />
    </div>
  )
}
