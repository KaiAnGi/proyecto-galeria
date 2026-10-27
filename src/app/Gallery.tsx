import { useRef, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { uploadDrawings } from '../features/gallery/upload'
import { queueObraTrash } from '../features/gallery/trashQueue'
import { useGalleryData } from '../features/gallery/useGalleryData'
import {
  filterObras,
  collectFacets,
  emptyFilters,
  hasActiveFilters,
  type ObrasFilters,
} from '../features/gallery/filters'
import { ensureToken } from '../features/auth/googleAuth'
import { friendlyError } from '../lib/errors/friendlyError'
import { es } from '../i18n/es'
import { SkullBowSticker } from '../components/Stickers'
import { PlusIcon, CameraIcon, ImagesIcon, SearchIcon } from '../components/Icons'

export default function Gallery() {
  const obras = useGalleryStore((s) => s.obras)
  const colecciones = useGalleryStore((s) => s.colecciones)
  const { state, error: loadError, retry, hasConnectedBefore } = useGalleryData()
  const [showAdd, setShowAdd] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<ObrasFilters>(emptyFilters)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const facets = useMemo(() => collectFacets(obras), [obras])
  const visibles = useMemo(() => filterObras(obras, filters), [obras, filters])
  const filtering = hasActiveFilters(filters)
  const loading = state === 'loading'

  function patchFilters(patch: Partial<ObrasFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      await ensureToken()
      const list = Array.from(files)
      await uploadDrawings(list)
      setShowAdd(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      console.error('Upload failed', e)
      setError(friendlyError(e, es.gallery.uploadError))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 fade-up">
          <img
            src="./icon.png"
            alt=""
            aria-hidden="true"
            className="hidden sm:block w-14 h-14 shrink-0 sticker-shadow sticker-float object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text truncate">{es.gallery.title}</h1>
            {obras.length > 0 && <p className="text-xs text-[var(--muted)]">{es.gallery.count(obras.length)}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 fade-up">
          <Link to="/" className="btn btn-soft">
            {es.obra.back}
          </Link>
          <button
            onClick={() => setShowAdd((v) => !v)}
            disabled={state !== 'ready'}
            className="btn btn-accent"
          >
            <PlusIcon className="w-5 h-5" />
            {es.gallery.add}
          </button>
        </div>
      </header>

      {showAdd && (
        <div
          className="panel p-4 sm:p-5 flex flex-col gap-4 fade-up"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            handleFiles(e.dataTransfer.files)
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.files
            if (items && items.length > 0) handleFiles(items)
          }}
        >
          <p className="text-sm text-[var(--muted)]">{es.gallery.dropHint}</p>
          <div className="flex flex-wrap gap-3">
            <label className="btn btn-soft">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={state !== 'ready' || uploading}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <CameraIcon className="w-5 h-5" />
              {es.gallery.camera}
            </label>
            <label className="btn btn-soft">
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                disabled={state !== 'ready' || uploading}
                onChange={(e) => handleFiles(e.target.files)}
              />
              <ImagesIcon className="w-5 h-5" />
              {es.gallery.pick}
            </label>
          </div>
          {uploading && <p className="text-sm text-[var(--muted)]">{es.gallery.uploading}</p>}
          {error && <p className="text-sm text-[#ff9db1]">{error}</p>}
        </div>
      )}

      <div className="panel p-4 flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)] pointer-events-none" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => patchFilters({ query: e.target.value })}
            aria-label={es.gallery.search}
            placeholder={es.gallery.search}
            className="field has-icon w-full"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.estado}
            onChange={(e) => patchFilters({ estado: e.target.value })}
            aria-label={es.gallery.filterEstado}
            className="field"
          >
            <option value="">{es.gallery.anyEstado}</option>
            <option value="boceto">{es.obra.estadoOptions.boceto}</option>
            <option value="en_proceso">{es.obra.estadoOptions.en_proceso}</option>
            <option value="terminada">{es.obra.estadoOptions.terminada}</option>
          </select>
          <select
            value={filters.coleccionId}
            onChange={(e) => patchFilters({ coleccionId: e.target.value })}
            aria-label={es.gallery.filterColeccion}
            className="field"
          >
            <option value="">{es.gallery.allColecciones}</option>
            {colecciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select
            value={filters.tecnica}
            onChange={(e) => patchFilters({ tecnica: e.target.value })}
            aria-label={es.gallery.filterTecnica}
            className="field"
          >
            <option value="">{es.gallery.anyTecnica}</option>
            {facets.tecnicas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filters.etiqueta}
            onChange={(e) => patchFilters({ etiqueta: e.target.value })}
            aria-label={es.gallery.filterEtiqueta}
            className="field"
          >
            <option value="">{es.gallery.anyEtiqueta}</option>
            {facets.etiquetas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {filtering && (
            <button onClick={() => setFilters(emptyFilters)} className="btn btn-soft">
              {es.gallery.clearFilters}
            </button>
          )}
        </div>
      </div>

      {state === 'error' && (
        <div className="panel p-5 text-center flex flex-col items-center gap-3">
          <p className="font-medium text-[var(--accent-soft)]">{loadError ?? es.gallery.loadError}</p>
          <button type="button" onClick={retry} className="btn btn-soft">
            {es.gallery.retryLoad}
          </button>
        </div>
      )}

      {state === 'idle' && hasConnectedBefore && (
        <div className="panel p-5 text-center">
          <p className="text-sm text-[var(--muted)]">{es.gallery.reconnectPrompt}</p>
        </div>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full flex flex-col items-center text-center gap-3 py-10">
            <img
              src="./icon.png"
              alt=""
              aria-hidden="true"
              className="w-20 h-20 sticker-shadow sticker-float hop object-contain"
            />
            <p className="text-sm text-[var(--muted)]">Revisando si has subido dibujitos...</p>
          </div>
        ) : obras.length === 0 ? (
          <div className="col-span-full flex flex-col items-center text-center gap-3 py-10">
            <img
              src="./icon.png"
              alt=""
              aria-hidden="true"
              className="w-24 h-24 sticker-shadow sticker-float pop-in object-contain"
            />
            <p className="text-lg font-semibold">{es.gallery.empty}</p>
            <p className="text-sm text-[var(--muted)] max-w-xs">{es.gallery.emptySub}</p>
            <button onClick={() => setShowAdd(true)} disabled={state !== 'ready'} className="btn btn-primary">
              <PlusIcon className="w-5 h-5" />
              {es.gallery.emptyCta}
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <div className="col-span-full flex flex-col items-center text-center gap-3 py-10">
            <SkullBowSticker className="w-20 h-20 sticker-float pop-in" />
            <p className="text-lg font-semibold">{es.gallery.noResults}</p>
            <p className="text-sm text-[var(--muted)] max-w-xs">{es.gallery.noResultsSub}</p>
          </div>
        ) : (
          visibles.map((obra, i) => (
            <Link
              key={obra.id}
              to={`/obra/${obra.id}`}
              className="card overflow-hidden relative fade-up"
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  queueObraTrash(obra)
                }}
                aria-label={es.obra.trash}
                className="absolute top-3 right-3 min-w-[44px] min-h-[44px] rounded-full bg-black/65 text-white hover:bg-black/80 focus-visible:outline-3 focus-visible:outline-[var(--accent)] text-sm z-10 backdrop-blur-sm"
              >
                ✕
              </button>
              {obra.miniatura ? (
                <div className="sticker-frame m-2.5 mb-0">
                  <img src={obra.miniatura} alt={obra.titulo} className="w-full h-40 object-cover" />
                </div>
              ) : (
                <div className="m-2.5 mb-0 h-40 rounded-2xl bg-black/25 flex items-center justify-center text-[var(--muted)] text-sm">
                  {es.gallery.noImage}
                </div>
              )}
              <div className="p-3">
                <h2 className="text-sm font-semibold truncate">{obra.titulo || es.gallery.untitled}</h2>
                <p className="text-xs text-[var(--muted)] mt-1">{obra.fecha}</p>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  )
}
