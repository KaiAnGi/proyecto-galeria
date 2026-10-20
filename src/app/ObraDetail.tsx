import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import ZoomableImage from '../features/gallery/ZoomableImage'
import VideoPlayer from '../features/gallery/VideoPlayer'
import CompareSlider from '../features/gallery/CompareSlider'
import Versiones from '../features/gallery/Versiones'
import { useDriveImage } from '../features/gallery/useDriveImage'
import { comparePair } from '../features/gallery/versions'
import { saveObra } from '../features/gallery/persistence'
import { parseList } from '../features/gallery/filters'
import { getToken } from '../features/auth/googleAuth'
import { ensureLoaded } from '../features/gallery/persistence'
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
  const [selectedArchivoId, setSelectedArchivoId] = useState<string | null>(null)
  const [compareOn, setCompareOn] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) return
    ensureLoaded(token).catch(() => undefined)
  }, [])

  const selectedArchivo = obra?.archivos.find((a) => a.id === selectedArchivoId) ?? obra?.archivos[0]
  const isVideo = selectedArchivo?.tipo === 'video'
  const mediaId = selectedArchivo
    ? isVideo
      ? selectedArchivo.drive.originalId
      : (selectedArchivo.drive.galeriaId ?? selectedArchivo.drive.originalId)
    : null
  const mediaUrl = useDriveImage(mediaId)

  const pair = obra ? comparePair(obra) : null
  const canCompare = pair !== null
  const compareActive = compareOn && canCompare && !isVideo
  const beforeId = compareActive ? (pair?.[0].drive.galeriaId ?? pair?.[0].drive.originalId) : null
  const afterId = compareActive ? (pair?.[1].drive.galeriaId ?? pair?.[1].drive.originalId) : null
  const beforeUrl = useDriveImage(beforeId)
  const afterUrl = useDriveImage(afterId)
  const compareLoading = compareActive && (!beforeUrl || !afterUrl)

  if ((obra?.id ?? undefined) !== lastObraId) {
    setLastObraId(obra?.id ?? undefined)
    setTitleDraft(obra?.titulo ?? '')
    setNotesDraft(obra?.notas ?? '')
    setTecnicasDraft(obra?.tecnicas.join(', ') ?? '')
    setTagsDraft(obra?.tags.join(', ') ?? '')
    setSelectedArchivoId(null)
    setCompareOn(false)
  }

  if (!obra) {
    return (
      <div className="min-h-full p-6 flex flex-col items-center justify-center gap-4">
        <p className="text-[var(--muted)]">{es.obra.notFound}</p>
        <Link to="/galeria" className="btn btn-soft">
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
          <div className="flex items-center gap-2 mb-2">
            <Link to="/" className="btn btn-soft">
              ← Volver
            </Link>
            <Link to="/galeria" className="btn btn-soft">
              {es.obra.back.replace('← ', '')}
            </Link>
          </div>
          <input
            aria-label={es.obra.title}
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={saveTitle}
            placeholder={es.obra.titlePlaceholder}
            className="w-full mt-2 text-2xl sm:text-3xl font-display font-bold bg-transparent border-2 border-transparent rounded-2xl px-2 py-1 focus:border-[var(--border)] focus:bg-[var(--surface)] outline-none"
          />
          <p className="text-sm text-[var(--muted)] px-2 flex flex-wrap items-center gap-2">
            <span>
              {obra.fecha} · {es.obra.estadoOptions[obra.estado]}
            </span>
            <span className="chip">{es.obra.autoSave}</span>
          </p>
        </div>
        <button onClick={handleTrash} className="btn btn-danger shrink-0">
          {es.obra.trash}
        </button>
      </header>

      <section className="flex items-center justify-center">
        {compareActive ? (
          compareLoading ? (
            <div className="py-16 text-[var(--muted)]">{es.versions.loadingCompare}</div>
          ) : (
            <CompareSlider
              srcBefore={beforeUrl ?? obra.miniatura}
              srcAfter={afterUrl ?? obra.miniatura}
              altBefore={es.versions.alt(obra.titulo, es.versions.before)}
              altAfter={es.versions.alt(obra.titulo, es.versions.after)}
            />
          )
        ) : isVideo ? (
          mediaUrl ? (
            <VideoPlayer src={mediaUrl} />
          ) : (
            <div className="py-16 text-[var(--muted)]">{es.app.loading}</div>
          )
        ) : selectedArchivo ? (
          <ZoomableImage src={mediaUrl ?? obra.miniatura} alt={obra.titulo} />
        ) : (
          <div className="py-16 text-[var(--muted)]">{es.gallery.noImage}</div>
        )}
      </section>

      <Versiones
        obra={obra}
        selectedId={selectedArchivo?.id ?? ''}
        onSelect={(archivoId) => {
          setSelectedArchivoId(archivoId)
          setCompareOn(false)
        }}
        compareOn={compareOn}
        canCompare={canCompare}
        onToggleCompare={() => setCompareOn((v) => !v)}
      />

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="panel p-4">
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
            className="field w-full resize-y"
          />
        </div>
        <div className="panel p-4 flex flex-col gap-4">
          <div>
            <label htmlFor="estado" className="text-sm font-medium block mb-2">
              {es.obra.estado}
            </label>
            <select
              id="estado"
              value={obra.estado}
              onChange={(e) => saveEstado(e.target.value as Obra['estado'])}
              className="field w-full"
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
              className="field w-full"
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
              className="field w-full"
            />
          </div>
        </div>
      </section>
    </div>
  )
}
