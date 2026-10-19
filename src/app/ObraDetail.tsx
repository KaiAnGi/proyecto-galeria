import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import ZoomableImage from '../features/gallery/ZoomableImage'
import VideoPlayer from '../features/gallery/VideoPlayer'
import { downloadFileAsBlob } from '../features/drive/driveImageClient'
import { saveObra } from '../features/gallery/persistence'
import { parseList } from '../features/gallery/filters'
import { getToken } from '../features/auth/googleAuth'
import type { Obra } from '../features/gallery/store'
import { es } from '../i18n/es'

export default function ObraDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const obra = useGalleryStore((s) => (id ? s.obras.find((o) => o.id === id) : undefined))
  const updateObra = useGalleryStore((s) => s.updateObra)
  const removeObraSoft = useGalleryStore((s) => s.removeObraSoft)
  const [titleDraft, setTitleDraft] = useState(obra?.titulo ?? '')
  const [notesDraft, setNotesDraft] = useState(obra?.notas ?? '')
  const [tecnicasDraft, setTecnicasDraft] = useState(obra?.tecnicas.join(', ') ?? '')
  const [tagsDraft, setTagsDraft] = useState(obra?.tags.join(', ') ?? '')
  const [lastObraId, setLastObraId] = useState<string | undefined>(obra?.id)
  const [mediaState, setMediaState] = useState<{ id: string | null; url: string | null }>({ id: null, url: null })
  const archivoFirst = obra?.archivos[0]
  const isVideo = archivoFirst?.tipo === 'video'
  const mediaId = isVideo ? archivoFirst?.drive.originalId : archivoFirst?.drive.galeriaId
  const mediaUrl = mediaState.id === mediaId ? mediaState.url : null

  useEffect(() => {
    let cancelled = false
    let objUrl: string | null = null
    const token = getToken()
    if (!mediaId || !token) return
    downloadFileAsBlob(token, mediaId)
      .then((blob: Blob) => {
        if (cancelled) return
        objUrl = URL.createObjectURL(blob)
        setMediaState({ id: mediaId, url: objUrl })
      })
      .catch(() => {
        // fallback a miniatura
      })
    return () => {
      cancelled = true
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [mediaId])

  if ((obra?.id ?? undefined) !== lastObraId) {
    setLastObraId(obra?.id ?? undefined)
    setTitleDraft(obra?.titulo ?? '')
    setNotesDraft(obra?.notas ?? '')
    setTecnicasDraft(obra?.tecnicas.join(', ') ?? '')
    setTagsDraft(obra?.tags.join(', ') ?? '')
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

  function saveList(kind: 'tecnicas' | 'tags') {
    if (!id || !obra) return
    const value = parseList(kind === 'tecnicas' ? tecnicasDraft : tagsDraft)
    const current = kind === 'tecnicas' ? obra.tecnicas : obra.tags
    if (value.length === current.length && value.every((v, i) => v === current[i])) return
    const patch: Partial<Obra> = kind === 'tecnicas' ? { tecnicas: value } : { tags: value }
    updateObra(id, patch)
    const token = getToken()
    if (token) saveObra(token, { ...obra, ...patch, updatedAt: new Date().toISOString() }).catch(() => undefined)
  }

  function saveEstado(estado: Obra['estado']) {
    if (!id || !obra || estado === obra.estado) return
    updateObra(id, { estado })
    const token = getToken()
    if (token) saveObra(token, { ...obra, estado, updatedAt: new Date().toISOString() }).catch(() => undefined)
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
            {obra.fecha} · {es.obra.estadoOptions[obra.estado]}
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
        {isVideo ? (
          mediaUrl ? (
            <VideoPlayer src={mediaUrl} />
          ) : (
            <div className="py-16 text-[var(--muted)]">{es.app.loading}</div>
          )
        ) : archivoFirst ? (
          <ZoomableImage src={mediaUrl ?? obra.miniatura} alt={obra.titulo} />
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
        <div className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)] flex flex-col gap-4">
          <div>
            <label htmlFor="estado" className="text-sm font-medium block mb-2">
              {es.obra.estado}
            </label>
            <select
              id="estado"
              value={obra.estado}
              onChange={(e) => saveEstado(e.target.value as Obra['estado'])}
              className="w-full min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
            >
              <option value="boceto">{es.obra.estadoOptions.boceto}</option>
              <option value="en_proceso">{es.obra.estadoOptions.en_proceso}</option>
              <option value="terminada">{es.obra.estadoOptions.terminada}</option>
            </select>
          </div>
          <div>
            <label htmlFor="tecnicas" className="text-sm font-medium block mb-2">
              {es.obra.techniques}
            </label>
            <input
              id="tecnicas"
              value={tecnicasDraft}
              onChange={(e) => setTecnicasDraft(e.target.value)}
              onBlur={() => saveList('tecnicas')}
              placeholder={es.obra.techniquesPlaceholder}
              className="w-full min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label htmlFor="etiquetas" className="text-sm font-medium block mb-2">
              {es.obra.tags}
            </label>
            <input
              id="etiquetas"
              value={tagsDraft}
              onChange={(e) => setTagsDraft(e.target.value)}
              onBlur={() => saveList('tags')}
              placeholder={es.obra.tagsPlaceholder}
              className="w-full min-h-[44px] px-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] outline-none focus:border-[var(--primary)]"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
