import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { useGalleryData } from '../features/gallery/useGalleryData'
import { useSequenceMedia } from '../features/gallery/useSequenceMedia'
import { useSequencePlayer } from '../features/gallery/useSequencePlayer'
import { queueSecuenciaTrash } from '../features/gallery/trashQueue'
import { saveSequenceDraft, type SequenceSaveProgress } from '../features/gallery/sequenceSave'
import {
  appendFramesToDraft,
  createDraftFromSequence,
  discardDraft,
  insertDraftFrame,
  moveDraftFrame,
  normalizeDraftFrames,
  prepareDraftFrames,
  removeDraftFrame,
  sortDraftFrames,
  useSequenceDrafts,
  type DraftFrame,
  type SequenceDraft,
} from '../features/gallery/sequenceDrafts'
import { friendlyError } from '../lib/errors/friendlyError'
import { es } from '../i18n/es'
import { PencilIcon, SaveIcon, TrashIcon } from '../components/Icons'
import CuteComment from '../components/CuteComment'
import FrameTimeline from '../components/animations/FrameTimeline'
import PlaybackTransport from '../components/animations/PlaybackTransport'

interface RemovedFrame {
  frame: DraftFrame
  index: number
}

const UNDO_MS = 7000

function saveStageMessage(progress: SequenceSaveProgress): string {
  if (progress.stage === 'preparing') return es.pencil.savePreparing
  if (progress.stage === 'video') return es.pencil.saveVideo(progress.done, progress.total)
  if (progress.stage === 'frames') return es.pencil.saveFrames(progress.done, progress.total)
  return es.pencil.saveFinishing
}

export default function AnimacionDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const sequence = useGalleryStore((state) => state.secuencias.find((item) => item.id === id))
  const draft = useSequenceDrafts((state) => state.drafts[id])
  const putDraft = useSequenceDrafts((state) => state.putDraft)
  const updateDraft = useSequenceDrafts((state) => state.updateDraft)
  const { state, error: loadError, retry, hasConnectedBefore } = useGalleryData()
  const [onion, setOnion] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addProgress, setAddProgress] = useState<{ done: number; total: number } | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveProgress, setSaveProgress] = useState<SequenceSaveProgress | null>(null)
  const [removedFrame, setRemovedFrame] = useState<RemovedFrame | null>(null)
  const pendingSelectRef = useRef<number | null>(null)
  const undoRef = useRef<{ frame: DraftFrame; index: number; timer: ReturnType<typeof setTimeout> } | null>(null)

  useEffect(() => {
    if (draft || !sequence) return
    putDraft(createDraftFromSequence(sequence))
  }, [draft, sequence, putDraft])

  const frames = useMemo(() => (draft ? sortDraftFrames(draft.frames) : []), [draft])
  const player = useSequencePlayer({
    frameCount: frames.length,
    fps: draft?.fps ?? 12,
    loop: draft?.bucle ?? true,
  })
  const currentFrame = frames[player.index]
  const remoteFrames = useMemo(
    () =>
      frames
        .filter((frame) => frame.existing && !frame.previewUrl)
        .map((frame) => ({ id: frame.id, orden: frame.orden, drive: frame.existing! })),
    [frames],
  )
  const remoteMedia = useSequenceMedia(remoteFrames, currentFrame?.id)
  const media = useMemo(() => {
    const result: Record<string, (typeof remoteMedia)[string]> = {}
    for (const frame of frames) {
      result[frame.id] = frame.previewUrl
        ? { url: frame.previewUrl, status: 'ready' }
        : (remoteMedia[frame.id] ?? { status: 'idle' })
    }
    return result
  }, [frames, remoteMedia])

  const previousFrame =
    onion && !player.playing && frames.length > 1
      ? player.index > 0
        ? frames[player.index - 1]
        : draft?.bucle
          ? frames[frames.length - 1]
          : undefined
      : undefined
  const previousMedia = previousFrame ? media[previousFrame.id] : undefined
  const currentMedia = currentFrame ? media[currentFrame.id] : undefined

  useEffect(() => {
    if (pendingSelectRef.current === null || pendingSelectRef.current >= frames.length) return
    player.seek(pendingSelectRef.current)
    pendingSelectRef.current = null
  }, [frames.length, player])

  useEffect(() => {
    if (!draft?.dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [draft?.dirty])

  useEffect(
    () => () => {
      const pending = undoRef.current
      if (!pending) return
      clearTimeout(pending.timer)
      if (pending.frame.previewUrl) URL.revokeObjectURL(pending.frame.previewUrl)
      undoRef.current = null
    },
    [],
  )

  function finalizeRemovedFrame(): void {
    const pending = undoRef.current
    if (!pending) return
    clearTimeout(pending.timer)
    if (pending.frame.previewUrl) URL.revokeObjectURL(pending.frame.previewUrl)
    undoRef.current = null
    setRemovedFrame(null)
  }

  function handleSeek(index: number) {
    player.pause()
    player.seek(index)
  }

  function handleDeleteAnimation() {
    player.pause()
    if (sequence) queueSecuenciaTrash(sequence)
    discardDraft(id)
    navigate('/animaciones')
  }

  function handleMove(from: number, to: number) {
    if (!draft) return
    player.pause()
    const selectedId = frames[player.index]?.id
    updateDraft(id, (current) => moveDraftFrame(current, from, to))
    if (!selectedId) return
    const next = sortDraftFrames(moveDraftFrame(draft, from, to).frames)
    const nextIndex = next.findIndex((frame) => frame.id === selectedId)
    if (nextIndex >= 0) player.seek(nextIndex)
  }

  function handleDelete(frame: DraftFrame) {
    if (!draft || frames.length <= 1) return
    player.pause()
    finalizeRemovedFrame()
    const index = frames.findIndex((item) => item.id === frame.id)
    if (index < 0) return
    updateDraft(id, (current) => removeDraftFrame(current, frame.id))
    setRemovedFrame({ frame, index })
    const timer = setTimeout(() => {
      undoRef.current = null
      if (frame.previewUrl) URL.revokeObjectURL(frame.previewUrl)
      setRemovedFrame(null)
    }, UNDO_MS)
    undoRef.current = { frame, index, timer }
    pendingSelectRef.current = Math.min(index, frames.length - 2)
  }

  function undoRemoveFrame() {
    const pending = undoRef.current
    if (!pending) return
    clearTimeout(pending.timer)
    undoRef.current = null
    setRemovedFrame(null)
    updateDraft(id, (current) => insertDraftFrame(current, pending.frame, pending.index))
    pendingSelectRef.current = pending.index
  }

  async function handleAddFiles(files: File[]) {
    if (!draft || files.length === 0 || adding || saving) return
    setAdding(true)
    setAddError(null)
    setAddProgress({ done: 0, total: files.length })
    const start = frames.length
    try {
      const prepared = await prepareDraftFrames(files, start, (done, total) => setAddProgress({ done, total }))
      updateDraft(id, (current) => appendFramesToDraft(current, prepared.frames))
      pendingSelectRef.current = start
    } catch (error) {
      console.error('Add frames failed', error)
      setAddError(friendlyError(error, es.pencil.addFramesError))
    } finally {
      setAdding(false)
      setAddProgress(null)
    }
  }

  async function save() {
    if (!draft || frames.length === 0 || saving || adding) return
    setSaving(true)
    setSaveError(null)
    setSaveProgress({ stage: 'preparing', done: 0, total: frames.length })
    try {
      const saved = await saveSequenceDraft(draft, setSaveProgress)
      const savedById = new Map(saved.frames.map((frame) => [frame.id, frame]))
      const nextDraft: SequenceDraft = {
        ...draft,
        titulo: saved.sequence.titulo,
        fps: saved.sequence.fps,
        bucle: saved.sequence.bucle,
        frames: normalizeDraftFrames(
          sortDraftFrames(draft.frames).map((frame) => {
            const savedFrame = savedById.get(frame.id)
            return savedFrame
              ? { ...frame, orden: savedFrame.orden, existing: savedFrame.drive }
              : frame
          }),
        ),
        folderId: saved.sequence.folderId,
        mainFileId: saved.sequence.mainFileId,
        videoMime: saved.sequence.videoMime,
        miniatura: saved.sequence.miniatura,
        coleccionIds: saved.sequence.coleccionIds ?? draft.coleccionIds,
        dirty: false,
      }
      putDraft(nextDraft)
      finalizeRemovedFrame()
    } catch (error) {
      console.error('Save animation failed', error)
      setSaveError(friendlyError(error, es.pencil.saveError))
    } finally {
      setSaving(false)
      setSaveProgress(null)
    }
  }

  if (!draft) {
    const loading = state === 'loading' || Boolean(sequence)
    return (
      <div className="flex min-h-full flex-col gap-4 p-4 sm:p-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PencilIcon className="h-7 w-7 text-[var(--accent-soft)]" />
            <h1 className="text-xl font-bold gradient-text">{es.pencil.title}</h1>
          </div>
          <Link to="/animaciones" className="btn btn-soft">
            ← {es.pencil.back}
          </Link>
        </header>
        <div className="panel flex flex-col items-center gap-3 p-5 text-center">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">{es.pencil.loading}</p>
          ) : state === 'error' ? (
            <>
              <p className="text-[var(--accent-soft)]">{loadError ?? es.gallery.loadError}</p>
              <button type="button" onClick={retry} className="btn btn-soft">
                {es.gallery.retryLoad}
              </button>
            </>
          ) : state === 'idle' && hasConnectedBefore ? (
            <p className="text-sm text-[var(--muted)]">{es.gallery.reconnectPrompt}</p>
          ) : (
            <p className="text-sm text-[var(--muted)]">{es.pencil.notFound}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 pb-0 sm:p-6 sm:pb-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 fade-up">
          <PencilIcon className="hidden h-7 w-7 shrink-0 text-[var(--accent-soft)] sm:block" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{es.pencil.kicker}</p>
            <input
              value={draft.titulo}
              onChange={(event) => updateDraft(id, (current) => ({ ...current, titulo: event.target.value }))}
              onBlur={() => {
                if (!draft.titulo.trim()) {
                  updateDraft(id, (current) => ({ ...current, titulo: es.pencil.defaultTitle }))
                }
              }}
              aria-label={es.pencil.titleLabel}
              placeholder={es.pencil.titlePlaceholder}
              disabled={saving}
              className="w-full min-w-0 border-0 bg-transparent p-0 text-xl font-bold text-[var(--accent-soft)] outline-none sm:text-2xl"
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || adding || frames.length === 0}
            className="btn btn-primary min-h-11"
          >
            <SaveIcon className="h-5 w-5" />
            {saving ? es.pencil.saving : es.pencil.save}
          </button>
          <button
            type="button"
            onClick={handleDeleteAnimation}
            disabled={saving}
            aria-label={es.pencil.deleteAnimation}
            className="btn btn-soft min-h-11 min-w-11 px-2"
          >
            <TrashIcon />
          </button>
          <Link to="/animaciones" className="btn btn-soft">
            ← {es.pencil.back}
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--muted)]">
        <p>{es.pencil.saveHint}</p>
        <p role="status">
          {saveProgress
            ? saveStageMessage(saveProgress)
            : draft.dirty
              ? es.pencil.unsaved
              : es.pencil.saved}
        </p>
      </div>

      <div className="relative mx-auto aspect-[4/3] w-full max-w-4xl overflow-hidden rounded-2xl border-2 border-[var(--border)] bg-black shadow-lg">
        {previousMedia?.url && (
          <img
            src={previousMedia.url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-contain opacity-40"
          />
        )}
        {currentMedia?.url ? (
          <img
            src={currentMedia.url}
            alt={es.pencil.frameAlt(player.index + 1)}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[var(--muted)]">
            {currentMedia?.status === 'error' ? es.pencil.loadFramesError : '…'}
          </div>
        )}
      </div>

      {addError && <p className="text-sm text-[#ff9db1]">{addError}</p>}
      {saveError && <p className="text-sm text-[#ff9db1]">{saveError}</p>}
      {addProgress && (
        <p role="status" className="text-sm text-[var(--muted)]">
          {es.pencil.preparingFrame(Math.min(addProgress.done + 1, addProgress.total), addProgress.total)}
        </p>
      )}

      {removedFrame && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
          <p>{es.pencil.frameRemoved}</p>
          <button
            type="button"
            onClick={undoRemoveFrame}
            disabled={saving}
            className="btn btn-accent min-h-11"
          >
            {es.gallery.undo}
          </button>
        </div>
      )}

      <FrameTimeline
        frames={frames}
        currentIndex={player.index}
        media={media}
        disabled={adding || saving}
        onSelect={handleSeek}
        onMove={handleMove}
        onDelete={handleDelete}
        onAddFiles={(files) => void handleAddFiles(files)}
      />

      <div className="mt-auto">
        <PlaybackTransport
          currentIndex={player.index}
          total={frames.length}
          playing={player.playing}
          loop={draft.bucle}
          onion={onion}
          fps={draft.fps}
          disabled={saving}
          onPrevious={() => player.step(-1)}
          onNext={() => player.step(1)}
          onToggle={player.toggle}
          onSeek={handleSeek}
          onLoop={(value) => updateDraft(id, (current) => ({ ...current, bucle: value }))}
          onOnion={setOnion}
          onFps={(value) => updateDraft(id, (current) => ({ ...current, fps: value }))}
        />
      </div>
      <CuteComment />
    </div>
  )
}
