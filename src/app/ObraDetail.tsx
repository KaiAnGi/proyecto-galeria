import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import ZoomableImage from '../features/gallery/ZoomableImage'
import { downloadFileAsBlob } from '../features/drive/driveImageClient'
import { saveObra } from '../features/gallery/persistence'
import { getToken } from '../features/auth/googleAuth'
import { es } from '../i18n/es'

export default function ObraDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const obra = useGalleryStore((s) => (id ? s.obras.find((o) => o.id === id) : undefined))
  const updateObra = useGalleryStore((s) => s.updateObra)
  const removeObraSoft = useGalleryStore((s) => s.removeObraSoft)
  const [titleDraft, setTitleDraft] = useState(obra?.titulo ?? '')
  const [notesDraft, setNotesDraft] = useState(obra?.notas ?? '')
  const [galleryState, setGalleryState] = useState<{ id: string | null; url: string | null }>({ id: null, url: null })
  const galeriaId = obra?.archivos[0]?.drive.galeriaId
  const galleryUrl = galleryState.id === galeriaId ? galleryState.url : null

  useEffect(() => {
    let cancelled = false
    let objUrl: string | null = null
    const token = getToken()
    if (!galeriaId || !token) return
    downloadFileAsBlob(token, galeriaId)
      .then((blob: Blob) => {
        if (cancelled) return
        objUrl = URL.createObjectURL(blob)
        setGalleryState({ id: galeriaId, url: objUrl })
      })
      .catch(() => {
        // fallback a miniatura
      })
    return () => {
      cancelled = true
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [galeriaId])

  if (titleDraft !== (obra?.titulo ?? '') || notesDraft !== (obra?.notas ?? '')) {
    const synced = obra?.titulo ?? ''
    const syncedNotes = obra?.notas ?? ''
    if (titleDraft !== synced) setTitleDraft(synced)
    if (notesDraft !== syncedNotes) setNotesDraft(syncedNotes)
  }

  if (!obra) {
    return (
      <div className="min-h-full p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-[var(--muted)]">{es.obra.notFound}</p>
        <Link to="/galeria" className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--surface)]">
          {es.obra.back}
        </Link>
      </div>
    )
  }

  const archivo = obra.archivos[0]

  function saveTitle() {
    if (!id || !obra) return
    if (titleDraft !== obra.titulo) {
      const newTitle = titleDraft.trim() || es.obra.titlePlaceholder
      updateObra(id, { titulo: newTitle })
      const token = getToken()
      if (token) saveObra(token, { ...obra, titulo: newTitle, updatedAt: new Date().toISOString() }).catch(() => undefined)
    }
  }

  function saveNotes() {
    if (!id || !obra) return
    if (notesDraft !== (obra.notas ?? '')) {
      const newNotes = notesDraft.trim() || undefined
      updateObra(id, { notas: newNotes })
      const token = getToken()
      if (token) saveObra(token, { ...obra, notas: newNotes, updatedAt: new Date().toISOString() }).catch(() => undefined)
    }
  }

  function handleTrash() {
    if (!id) return
    if (window.confirm(es.obra.deleteConfirm)) {
      removeObraSoft(id)
      navigate('/galeria')
    }
  }

  return (
    <div className="min-h-full p-4 sm:p-6 flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link to="/galeria" className="text-sm text-[var(--muted)]">
            {es.obra.back}
          </Link>
          <input
            aria-label={es.obra.title}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            placeholder={es.obra.titlePlaceholder}
            className="w-full mt-1 text-2xl font-bold bg-transparent border border-transparent rounded px-2 py-1 focus:border-[var(--border)] focus:bg-[var(--surface)] outline-none"
          />
          <p className="text-sm text-[var(--muted)] px-2">
            {obra.fecha} · {obra.estado}
          </p>
        </div>
        <button
          onClick={handleTrash}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-red-300 shrink-0"
        >
          {es.obra.trash}
        </button>
      </header>

      <section className="flex items-center justify-center">
        {archivo ? (
          <ZoomableImage src={galleryUrl ?? obra.miniatura} alt={obra.titulo} />
        ) : (
          <div className="py-16 text-[var(--muted)]">{es.gallery.noImage}</div>
        )}
      </section>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
          <label htmlFor="notas" className="text-sm font-medium block mb-2">
            {es.obra.notes}
          </label>
          <textarea
            id="notas"
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={saveNotes}
            placeholder={es.obra.notesPlaceholder}
            rows={6}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded p-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>
        <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
          <h2 className="text-sm font-medium mb-2">{es.obra.techniques}</h2>
          <p className="text-sm text-[var(--muted)]">{obra.tecnicas.length ? obra.tecnicas.join(', ') : '-'}</p>
        </div>
      </section>
    </div>
  )
}
