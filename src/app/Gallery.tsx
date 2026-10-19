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
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{es.gallery.title}</h1>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="min-h-[44px] px-5 py-3 rounded-lg bg-[var(--primary)] text-[var(--text)]"
        >
          {es.gallery.add}
        </button>
      </header>

      {showAdd && (
        <div
          className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)] flex flex-col gap-4"
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
            <label className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {es.gallery.camera}
            </label>
            <label className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              {es.gallery.pick}
            </label>
          </div>
          {uploading && <p className="text-sm text-[var(--muted)]">{es.gallery.uploading}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      )}

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 flex flex-col gap-3">
        <input
          type="search"
          value={filters.query}
          onChange={(e) => patchFilters({ query: e.target.value })}
          aria-label={es.gallery.search}
          placeholder={es.gallery.search}
          className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] outline-none focus:border-[var(--primary)]"
        />
        <div className="flex flex-wrap gap-3">
          <select
            value={filters.estado}
            onChange={(e) => patchFilters({ estado: e.target.value })}
            aria-label={es.gallery.filterEstado}
            className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
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
            className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
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
            className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
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
            className="min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
          >
            <option value="">{es.gallery.anyEtiqueta}</option>
            {facets.etiquetas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {filtering && (
            <button
              onClick={() => setFilters(emptyFilters)}
              className="min-h-[44px] px-4 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
            >
              {es.gallery.clearFilters}
            </button>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {obras.length === 0 ? (
          <p className="col-span-full text-center text-[var(--muted)] py-12">{es.gallery.empty}</p>
        ) : visibles.length === 0 ? (
          <p className="col-span-full text-center text-[var(--muted)] py-12">{es.gallery.noResults}</p>
        ) : (
          visibles.map((obra) => (
            <Link
              key={obra.id}
              to={`/obra/${obra.id}`}
              className="block bg-[var(--surface)] rounded-lg overflow-hidden border border-[var(--border)] relative group"
            >
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  removeObraSoft(obra.id)
                  setUndoId(obra.id)
                }}
                aria-label={es.obra.trash}
                className="absolute top-2 right-2 min-w-[44px] min-h-[44px] rounded-full bg-black/60 text-white opacity-70 hover:opacity-100 focus:opacity-100 text-sm z-10"
              >
                ✕
              </button>
              {obra.miniatura ? (
                <img src={obra.miniatura} alt={obra.titulo} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 flex items-center justify-center text-[var(--muted)] text-sm">
                  {es.gallery.noImage}
                </div>
              )}
              <div className="p-3">
                <h2 className="text-sm font-medium truncate">{obra.titulo || es.gallery.untitled}</h2>
                <p className="text-xs text-[var(--muted)] mt-1">{obra.fecha}</p>
              </div>
            </Link>
          ))
        )}
      </section>

      {undoId && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-3 flex items-center gap-4 shadow-lg z-20">
          <span className="text-sm">{es.gallery.trashed}</span>
          <button onClick={handleUndo} className="min-h-[44px] px-4 rounded-lg bg-[var(--primary)] text-[var(--text)] text-sm">
            {es.gallery.undo}
          </button>
        </div>
      )}
    </div>
  )
}
