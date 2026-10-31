import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { useGalleryData } from '../features/gallery/useGalleryData'
import { useSequenceMedia } from '../features/gallery/useSequenceMedia'
import { useSequencePlayer } from '../features/gallery/useSequencePlayer'
import { queueFrameTrash, queueSecuenciaTrash } from '../features/gallery/trashQueue'
import { moveFrame, appendFrames, gifSignature, sortFrames } from '../features/gallery/sequenceFrames'
import { persistLatestSequence } from '../features/gallery/sequenceSave'
import { scheduleGifRefresh } from '../features/gallery/gifRefreshScheduler'
import { refreshSequenceCover } from '../features/gallery/sequenceCover'
import { uploadAppendedFrames } from '../features/gallery/pencilUpload'
import { startOriginalUploads } from '../features/gallery/originalUploads'
import { friendlyError } from '../lib/errors/friendlyError'
import type { Frame, Secuencia } from '../features/gallery/secuencias'
import { es } from '../i18n/es'
import { PencilIcon, TrashIcon } from '../components/Icons'
import FrameTimeline from '../components/animations/FrameTimeline'
import PlaybackTransport from '../components/animations/PlaybackTransport'

interface SaveOptions {
  gif?: boolean
  cover?: boolean
}

export default function AnimacionDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const sequence = useGalleryStore((state) => state.secuencias.find((item) => item.id === id))
  const { state, error: loadError, retry, hasConnectedBefore } = useGalleryData()
  const [title, setTitle] = useState(sequence?.titulo ?? '')
  const [fpsDraft, setFpsDraft] = useState(sequence?.fps ?? 12)
  const [onion, setOnion] = useState(false)
  const [appending, setAppending] = useState(false)
  const [appendProgress, setAppendProgress] = useState<{ done: number; total: number } | null>(null)
  const [appendError, setAppendError] = useState<string | null>(null)
  const pendingSelectRef = useRef<number | null>(null)
  const loadedIdRef = useRef<string | null>(null)

  const storedFrames = sequence?.frames
  const frames = useMemo(() => (storedFrames ? sortFrames(storedFrames) : []), [storedFrames])
  const player = useSequencePlayer({
    frameCount: frames.length,
    fps: fpsDraft,
    loop: sequence?.bucle ?? true,
  })
  const currentFrame = frames[player.index]
  const media = useSequenceMedia(frames, currentFrame?.id)
  const previousFrame =
    onion && !player.playing && frames.length > 1
      ? player.index > 0
        ? frames[player.index - 1]
        : sequence?.bucle
          ? frames[frames.length - 1]
          : undefined
      : undefined
  const previousMedia = previousFrame ? media[previousFrame.id] : undefined
  const currentMedia = currentFrame ? media[currentFrame.id] : undefined
  const signature = sequence ? gifSignature(sequence) : ''
  const gifStale = Boolean(sequence?.mainFileId && sequence?.gifSignature && sequence.gifSignature !== signature)

  const savePatch = useCallback(
    (patch: Partial<Secuencia>, options: SaveOptions = {}) => {
      const latest = useGalleryStore.getState().secuencias.find((item) => item.id === id)
      if (!latest) return
      useGalleryStore.getState().updateSecuencia(id, patch)
      persistLatestSequence(id)
      if (options.gif) scheduleGifRefresh(id)
      if (options.cover) void refreshSequenceCover(id)
    },
    [id],
  )

  useEffect(() => {
    if (!sequence || loadedIdRef.current === sequence.id) return
    loadedIdRef.current = sequence.id
    setTitle(sequence.titulo)
    setFpsDraft(sequence.fps)
    setAppendError(null)
    pendingSelectRef.current = null
  }, [sequence])

  useEffect(() => {
    if (!sequence?.id) return
    const nextTitle = title.trim() || es.pencil.defaultTitle
    if (nextTitle === sequence.titulo) return
    const timer = setTimeout(() => savePatch({ titulo: nextTitle }), 700)
    return () => clearTimeout(timer)
  }, [title, sequence?.id, sequence?.titulo, savePatch])

  useEffect(() => {
    if (!sequence?.id || fpsDraft === sequence.fps) return
    const timer = setTimeout(() => savePatch({ fps: fpsDraft }, { gif: true }), 450)
    return () => clearTimeout(timer)
  }, [fpsDraft, sequence?.id, sequence?.fps, savePatch])

  useEffect(() => {
    if (pendingSelectRef.current === null || pendingSelectRef.current >= frames.length) return
    player.seek(pendingSelectRef.current)
    pendingSelectRef.current = null
  }, [frames.length, player])

  function handleSeek(index: number) {
    player.pause()
    player.seek(index)
  }

  function handleDeleteAnimation() {
    if (!sequence) return
    player.pause()
    queueSecuenciaTrash(sequence)
    navigate('/animaciones')
  }

  function handleMove(from: number, to: number) {
    if (!sequence) return
    player.pause()
    const selectedId = frames[player.index]?.id
    const firstBefore = frames[0]?.id
    const nextFrames = moveFrame(sequence.frames, from, to)
    savePatch({ frames: nextFrames }, { gif: true, cover: firstBefore !== nextFrames[0]?.id })
    const nextIndex = selectedId ? sortFrames(nextFrames).findIndex((frame) => frame.id === selectedId) : -1
    if (nextIndex >= 0) player.seek(nextIndex)
  }

  function handleDelete(frame: Frame) {
    if (!sequence) return
    player.pause()
    queueFrameTrash(sequence, frame)
  }

  async function handleAddFiles(files: File[]) {
    if (!sequence || files.length === 0 || appending) return
    setAppending(true)
    setAppendError(null)
    setAppendProgress({ done: 0, total: files.length })
    try {
      const uploaded = await uploadAppendedFrames(sequence, files, (done, total) =>
        setAppendProgress({ done, total }),
      )
      const added = uploaded.frames.map((item) => ({ id: item.id, orden: item.orden, drive: item.drive }))
      const latest = useGalleryStore.getState().secuencias.find((item) => item.id === sequence.id)
      if (!latest) return
      const nextFrames = appendFrames(latest.frames, added)
      pendingSelectRef.current = sortFrames(latest.frames).length
      savePatch({ frames: nextFrames }, { gif: true })
      startOriginalUploads(sequence.id, latest.titulo, uploaded)
    } catch (error) {
      console.error('Append frames failed', error)
      setAppendError(friendlyError(error, es.pencil.addFramesError))
    } finally {
      setAppending(false)
      setAppendProgress(null)
    }
  }

  if (!sequence) {
    const loading = state === 'loading'
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
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3 fade-up">
          <PencilIcon className="hidden h-7 w-7 shrink-0 text-[var(--accent-soft)] sm:block" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{es.pencil.kicker}</p>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                if (!title.trim()) {
                  setTitle(es.pencil.defaultTitle)
                  savePatch({ titulo: es.pencil.defaultTitle })
                }
              }}
              aria-label={es.pencil.titleLabel}
              placeholder={es.pencil.titlePlaceholder}
              className="w-full min-w-0 border-0 bg-transparent p-0 text-xl font-bold text-[var(--accent-soft)] outline-none sm:text-2xl"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDeleteAnimation}
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

      {gifStale && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
          <p>{es.pencil.gifOutdated}</p>
          <button type="button" onClick={() => scheduleGifRefresh(sequence.id, 0)} className="btn btn-soft">
            {es.pencil.updateGif}
          </button>
        </div>
      )}

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

      {appendError && <p className="text-sm text-[#ff9db1]">{appendError}</p>}
      {appendProgress && (
        <p role="status" className="text-sm text-[var(--muted)]">
          {es.pencil.uploadingFrame(Math.min(appendProgress.done + 1, appendProgress.total), appendProgress.total)}
        </p>
      )}

      <FrameTimeline
        frames={frames}
        currentIndex={player.index}
        media={media}
        disabled={appending}
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
          loop={sequence.bucle}
          onion={onion}
          fps={fpsDraft}
          onPrevious={() => player.step(-1)}
          onNext={() => player.step(1)}
          onToggle={player.toggle}
          onSeek={handleSeek}
          onLoop={(value) => savePatch({ bucle: value }, { gif: true })}
          onOnion={setOnion}
          onFps={setFpsDraft}
        />
      </div>
    </div>
  )
}
