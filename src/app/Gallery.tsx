import { useRef, useState, useEffect, useMemo } from 'react'
import { useGalleryStore } from '../features/gallery/store'
import { Link } from 'react-router-dom'
import { uploadDrawings } from '../features/gallery/upload'
import { ensureLoaded, trashObra } from '../features/gallery/persistence'
import {
  filterObras,
  collectFacets,
  emptyFilters,
  hasActiveFilters,
  type ObrasFilters,
} from '../features/gallery/filters'
import { getToken } from '../features/auth/googleAuth'
import { es } from '../i18n/es'
import { SkullBowSticker } from '../components/Stickers'
import { PlusIcon, CameraIcon, ImagesIcon, SearchIcon } from '../components/Icons'

export default function Gallery() {
  const obras = useGalleryStore((s) => s.obras)
  const colecciones = useGalleryStore((s) => s.colecciones)
  const removeObraSoft = useGalleryStore((s) => s.removeObraSoft)
  const clearTrashUndo = useGalleryStore((s) => s.clearTrashUndo)
  const trashedById = useGalleryStore((s) => s.trashedById)
  const [showAdd, setShowAdd] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [undoId, setUndoId] = useState<string | null>(null)
  const [filters, setFilters] = useState<ObrasFilters>(emptyFilters)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const facets = useMemo(() => collectFacets(obras), [obras])
  const visibles = useMemo(() => filterObras(obras, filters), [obras, filters])
  const filtering = hasActiveFilters(filters)

  function patchFilters(patch: Partial<ObrasFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
  }

  useEffect(() => {
    const token = getToken()
    if (!token) return
    ensureLoaded(token).catch(() => {
      // sin conexión: se muestra lo que ya hubiera en memoria
    })
  }, [])

  useEffect(() => {
    if (!undoId) return
    const t = setTimeout(() => {
      const obra = trashedById[undoId]
      const token = getToken()
      clearTrashUndo(undoId)
      setUndoId(null)
      if (obra && token) trashObra(token, obra).catch(() => undefined)
    }, 5000)
    return () => clearTimeout(t)
  }, [undoId, trashedById, clearTrashUndo])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const list = Array.from(files)
      await uploadDrawings(list)
      setShowAdd(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : es.gallery.uploadError)
    } finally {
      setUploading(false)
    }
  }

  function handleUndo() {
    if (!undoId) return
    const obra = trashedById[undoId]
    if (obra) useGalleryStore.getState().addObra(obra)
    clearTrashUndo(undoId)
    setUndoId(null)
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
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="btn btn-accent shrink-0 fade-up"
        >
          <PlusIcon className="w-5 h-5" />
          {es.gallery.add}
        </button>
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

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {obras.length === 0 ? (
          <div className="col-span-full flex flex-col items-center text-center gap-3 py-10">
            <img
              src="./icon.png"
              alt=""
              aria-hidden="true"
              className="w-24 h-24 sticker-shadow sticker-float pop-in object-contain"
            />
            <p className="text-lg font-semibold">{es.gallery.empty}</p>
            <p className="text-sm text-[var(--muted)] max-w-xs">{es.gallery.emptySub}</p>
            <button onClick={() => setShowAdd(true)} className="btn btn-primary">
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
                  removeObraSoft(obra.id)
                  setUndoId(obra.id)
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

      {undoId && (
        <div
          className="fixed left-1/2 -translate-x-1/2 panel px-4 py-3 flex items-center gap-4 z-20 pop-in"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <span className="text-sm">{es.gallery.trashed}</span>
          <button onClick={handleUndo} className="btn btn-accent">
            {es.gallery.undo}
          </button>
        </div>
      )}
    </div>
  )
}
