import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { useGalleryData } from '../features/gallery/useGalleryData'
import { useSequenceMedia, type FrameMedia } from '../features/gallery/useSequenceMedia'
import { useSequencePlayer } from '../features/gallery/useSequencePlayer'
import { useFrameImages } from '../features/gallery/useFrameImages'
import { queueSecuenciaTrash } from '../features/gallery/trashQueue'
import { saveSequenceDraft, type SequenceSaveProgress } from '../features/gallery/sequenceSave'
import { clampHold, normalizeRange, type LoopRange, type PlaybackMode, type PlaybackSpeed } from '../features/gallery/frameTiming'
import {
  deleteDraftFromStorage,
  loadDraftFromStorage,
  saveDraftToStorage,
} from '../features/gallery/draftStorage'
import {
  appendFramesToDraft,
  createDraftFromSequence,
  discardDraft,
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
import AnimationStage, { type StageBackground } from '../components/animations/AnimationStage'
import FrameTimeline from '../components/animations/FrameTimeline'
import PlaybackTransport from '../components/animations/PlaybackTransport'
import ShortcutsHelp from '../components/animations/ShortcutsHelp'
import { useEditorShortcuts } from '../components/animations/useEditorShortcuts'

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
  const history = useSequenceDrafts((state) => state.histories[id])
  const putDraft = useSequenceDrafts((state) => state.putDraft)
  const updateDraft = useSequenceDrafts((state) => state.updateDraft)
  const commitDraft = useSequenceDrafts((state) => state.commitDraft)
  const undoDraft = useSequenceDrafts((state) => state.undoDraft)
  const redoDraft = useSequenceDrafts((state) => state.redoDraft)
  const clearHistory = useSequenceDrafts((state) => state.clearHistory)
  const { state, error: loadError, retry, hasConnectedBefore } = useGalleryData()
  const [onion, setOnion] = useState(false)
  const [onionOpacity, setOnionOpacity] = useState(0.35)
  const [onionPrevious, setOnionPrevious] = useState(true)
  const [onionNext, setOnionNext] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [pingPong, setPingPong] = useState(false)
  const [background, setBackground] = useState<StageBackground>('checker')
  const [helpOpen, setHelpOpen] = useState(false)
  const [resetSignal, setResetSignal] = useState(0)
  const [draftNotice, setDraftNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addProgress, setAddProgress] = useState<{ done: number; total: number } | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveProgress, setSaveProgress] = useState<SequenceSaveProgress | null>(null)
  const [removedFrame, setRemovedFrame] = useState<RemovedFrame | null>(null)
  const pendingSelectRef = useRef<number | null>(null)
  const undoRef = useRef<{ frame: DraftFrame; index: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const mediaRef = useRef<Record<string, FrameMedia>>({})

  useEffect(() => {
    if (draft || !sequence) return
    let cancelled = false
    void loadDraftFromStorage(sequence.id).then((stored) => {
      if (cancelled) return
      if (useSequenceDrafts.getState().drafts[sequence.id]) return
      putDraft(stored && stored.dirty ? stored : createDraftFromSequence(sequence))
    })
    return () => {
      cancelled = true
    }
  }, [draft, sequence, putDraft])

  useEffect(() => {
    if (!draft?.dirty) return
    let cancelled = false
    const timer = setTimeout(() => {
      void saveDraftToStorage(draft).then((saved) => {
        if (!cancelled) setDraftNotice(saved ? es.pencil.draftSaved : es.pencil.draftSaveError)
      })
    }, 900)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [draft])

  const frames = useMemo(() => (draft ? sortDraftFrames(draft.frames) : []), [draft])
  const frameHolds = useMemo(() => frames.map((frame) => clampHold(frame.hold)), [frames])
  const range = normalizeRange(
    draft?.bucleRango ? { start: draft.bucleRango[0], end: draft.bucleRango[1] } : undefined,
    frames.length,
  )
  const loopMode: PlaybackMode = pingPong ? 'pingpong' : draft?.bucle ? 'loop' : 'once'
  const player = useSequencePlayer({
    frameHolds,
    fps: draft?.fps ?? 12,
    mode: loopMode,
    range,
    speed,
    isReady: (frameIndex) => {
      const frame = frames[frameIndex]
      return !frame || mediaRef.current[frame.id]?.status === 'ready'
    },
  })
  const currentFrame = frames[player.index]
  const remoteFrames = useMemo(
    () =>
      frames
        .filter((frame) => frame.existing && !frame.previewUrl)
        .map((frame) => ({ id: frame.id, orden: frame.orden, drive: frame.existing! })),
    [frames],
  )
  const { media: remoteMedia, retry: retryFrame } = useSequenceMedia(remoteFrames, currentFrame?.id)
  const media = useMemo(() => {
    const result: Record<string, FrameMedia> = {}
    for (const frame of frames) {
      result[frame.id] = frame.previewUrl
        ? { url: frame.previewUrl, status: 'ready' }
        : (remoteMedia[frame.id] ?? { status: 'idle' })
    }
    return result
  }, [frames, remoteMedia])

  useEffect(() => {
    mediaRef.current = media
  }, [media])

  const wrapping = loopMode !== 'once'
  const previousFrame =
    onion && frames.length > 1
      ? player.index > 0
        ? frames[player.index - 1]
        : wrapping
          ? frames[frames.length - 1]
          : undefined
      : undefined
  const nextFrame =
    onion && frames.length > 1
      ? player.index < frames.length - 1
        ? frames[player.index + 1]
        : wrapping
          ? frames[0]
          : undefined
      : undefined
  const currentMedia = currentFrame ? media[currentFrame.id] : undefined
  const images = useFrameImages(media, [previousFrame?.id, currentFrame?.id, nextFrame?.id])
  const currentImage = currentFrame ? images[currentFrame.id] : undefined
  const stageStatus =
    frames.length === 0
      ? 'empty'
      : currentMedia?.status === 'error'
        ? 'error'
        : currentImage
          ? 'ready'
          : 'loading'

  useEffect(() => {
    const target = player.waitingFor
    if (target === null) return
    const frame = frames[target]
    if (!frame || !images[frame.id]) return
    player.seekFrame(target)
    player.play()
  }, [player, frames, images])

  useEffect(() => {
    if (pendingSelectRef.current === null || pendingSelectRef.current >= frames.length) return
    player.seekFrame(pendingSelectRef.current)
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

  useEditorShortcuts({
    enabled: Boolean(draft) && !saving && !adding,
    onTogglePlay: () => {
      player.pause()
      player.toggle()
    },
    onPrevious: () => player.step(-1),
    onNext: () => player.step(1),
    onUndo: handleUndo,
    onRedo: handleRedo,
    onToggleOnion: () => setOnion((value) => !value),
    onHelp: () => setHelpOpen(true),
  })

  function finalizeRemovedFrame(): void {
    const pending = undoRef.current
    if (!pending) return
    clearTimeout(pending.timer)
    undoRef.current = null
    setRemovedFrame(null)
  }

  function handleSeek(index: number) {
    player.pause()
    player.seekFrame(index)
  }

  function handleUndo() {
    player.pause()
    undoDraft(id)
  }

  function handleRedo() {
    player.pause()
    redoDraft(id)
  }

  function handleLoopMode(value: PlaybackMode) {
    if (value === 'pingpong') {
      setPingPong(true)
      if (draft && !draft.bucle) updateDraft(id, (current) => ({ ...current, bucle: true }))
      return
    }
    setPingPong(false)
    updateDraft(id, (current) => ({ ...current, bucle: value === 'loop' }))
  }

  function handleRange(value: LoopRange | null) {
    updateDraft(id, (current) => ({
      ...current,
      bucleRango: value ? [value.start, value.end] : undefined,
    }))
  }

  function handleHold(value: number) {
    if (!currentFrame) return
    const frameId = currentFrame.id
    commitDraft(id, (current) => ({
      ...current,
      frames: current.frames.map((frame) =>
        frame.id === frameId ? { ...frame, hold: value > 1 ? value : undefined } : frame,
      ),
    }))
  }

  function handleBackground() {
    setBackground((value) => (value === 'checker' ? 'black' : value === 'black' ? 'white' : 'checker'))
  }

  function handleDeleteAnimation() {
    player.pause()
    if (sequence) queueSecuenciaTrash(sequence)
    discardDraft(id)
    void deleteDraftFromStorage(id)
    navigate('/animaciones')
  }

  function handleMove(from: number, to: number) {
    if (!draft) return
    player.pause()
    const selectedId = frames[player.index]?.id
    commitDraft(id, (current) => moveDraftFrame(current, from, to))
    if (!selectedId) return
    const next = sortDraftFrames(moveDraftFrame(draft, from, to).frames)
    const nextIndex = next.findIndex((frame) => frame.id === selectedId)
    if (nextIndex >= 0) player.seekFrame(nextIndex)
  }

  function handleDelete(frame: DraftFrame) {
    if (!draft || frames.length <= 1) return
    player.pause()
    finalizeRemovedFrame()
    const index = frames.findIndex((item) => item.id === frame.id)
    if (index < 0) return
    commitDraft(id, (current) => removeDraftFrame(current, frame.id))
    setRemovedFrame({ frame, index })
    const timer = setTimeout(() => {
      undoRef.current = null
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
    undoDraft(id)
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
      commitDraft(id, (current) => appendFramesToDraft(current, prepared.frames))
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
      clearHistory(id)
      setDraftNotice(null)
      finalizeRemovedFrame()
      void deleteDraftFromStorage(id)
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

  const backgroundLabel =
    background === 'checker'
      ? es.pencil.backgroundChecker
      : background === 'black'
        ? es.pencil.backgroundBlack
        : es.pencil.backgroundWhite

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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={saving || !history?.past.length}
          aria-label={es.pencil.undoEdit}
          className="btn btn-soft min-h-11 min-w-11 px-2"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={saving || !history?.future.length}
          aria-label={es.pencil.redoEdit}
          className="btn btn-soft min-h-11 min-w-11 px-2"
        >
          ↷
        </button>
        <button
          type="button"
          onClick={handleBackground}
          aria-label={es.pencil.backgroundLabel(backgroundLabel)}
          className="btn btn-soft min-h-11 text-sm"
        >
          {backgroundLabel}
        </button>
        <button
          type="button"
          onClick={() => setResetSignal((value) => value + 1)}
          className="btn btn-soft min-h-11 text-sm"
        >
          {es.pencil.resetView}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!currentFrame) return
            updateDraft(id, (current) => ({ ...current, portadaFrameId: currentFrame.id }))
          }}
          disabled={!currentFrame || draft.portadaFrameId === currentFrame?.id}
          className="btn btn-soft min-h-11 text-sm"
        >
          {es.pencil.setCover}
        </button>
        <details className="relative">
          <summary className="btn btn-soft min-h-11 cursor-pointer list-none text-sm">
            {es.pencil.exportSettings}
          </summary>
          <div className="popover left-0 w-64">
            <p className="text-sm font-semibold">{es.pencil.exportOptions}</p>
            <label className="flex flex-col gap-1 text-sm">
              <span>{es.pencil.exportRepeats}</span>
              <select
                value={draft.exportSettings?.repeats ?? 1}
                onChange={(event) =>
                  updateDraft(id, (current) => ({
                    ...current,
                    exportSettings: { ...current.exportSettings, repeats: Number(event.target.value) },
                  }))
                }
                className="field text-sm"
              >
                {[1, 2, 3].map((value) => (
                  <option key={value} value={value}>
                    {es.pencil.exportRepeatsValue(value)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-sm">{es.pencil.exportBackground}</legend>
              <div className="flex gap-2">
                {(['black', 'white'] as const).map((value) => (
                  <label key={value} className="flex min-h-11 flex-1 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="export-background"
                      value={value}
                      checked={(draft.exportSettings?.background ?? 'black') === value}
                      onChange={() =>
                        updateDraft(id, (current) => ({
                          ...current,
                          exportSettings: { ...current.exportSettings, background: value },
                        }))
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    {value === 'black' ? es.pencil.backgroundBlack : es.pencil.backgroundWhite}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-[var(--muted)]">{es.pencil.exportHint}</p>
          </div>
        </details>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="btn btn-soft min-h-11 text-sm"
        >
          {es.pencil.shortcuts}
        </button>
        {draftNotice && <span className="ml-auto text-xs text-[var(--muted)]">{draftNotice}</span>}
      </div>

      <AnimationStage
        current={currentImage}
        previous={previousFrame ? images[previousFrame.id] : undefined}
        next={nextFrame ? images[nextFrame.id] : undefined}
        status={stageStatus}
        showOnion={onion && !player.playing}
        onionPrevious={onionPrevious}
        onionNext={onionNext}
        onionOpacity={onionOpacity}
        background={background}
        label={es.pencil.stageLabel(player.index + 1, frames.length)}
        resetSignal={resetSignal}
        onRetry={() => currentFrame && retryFrame(currentFrame.id)}
      />

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
        coverFrameId={draft.portadaFrameId}
        disabled={adding || saving}
        onSelect={handleSeek}
        onMove={handleMove}
        onDelete={handleDelete}
        onAddFiles={(files) => void handleAddFiles(files)}
        onRetry={(frame) => retryFrame(frame.id)}
      />

      <div className="mt-auto">
        <PlaybackTransport
          currentIndex={player.index}
          total={frames.length}
          playing={player.playing}
          waiting={player.waiting}
          loopMode={loopMode}
          speed={speed}
          onion={onion}
          onionOpacity={onionOpacity}
          onionPrevious={onionPrevious}
          onionNext={onionNext}
          fps={draft.fps}
          hold={clampHold(currentFrame?.hold)}
          tick={player.tick}
          tickCount={player.tickCount}
          range={range}
          disabled={saving}
          onPrevious={() => player.step(-1)}
          onNext={() => player.step(1)}
          onToggle={player.toggle}
          onSeek={handleSeek}
          onLoopMode={handleLoopMode}
          onSpeed={setSpeed}
          onOnion={setOnion}
          onOnionOpacity={setOnionOpacity}
          onOnionPrevious={setOnionPrevious}
          onOnionNext={setOnionNext}
          onFps={(value) => updateDraft(id, (current) => ({ ...current, fps: value }))}
          onHold={handleHold}
          onRange={handleRange}
        />
      </div>

      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CuteComment />
    </div>
  )
}
