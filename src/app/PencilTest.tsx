import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { ulid } from 'ulidx'
import { ensureToken } from '../features/auth/googleAuth'
import { useAuth } from '../features/auth/useAuth'
import { ensureLoaded, isGalleryLoaded, saveSecuencia } from '../features/gallery/persistence'
import { useGalleryData } from '../features/gallery/useGalleryData'
import { enqueueSave } from '../features/gallery/saveQueue'
import { uploadFrames } from '../features/gallery/pencilUpload'
import { withUpdatedAt } from '../features/gallery/secuencias'
import { downloadFileAsBlob } from '../features/drive/driveImageClient'
import { friendlyError } from '../lib/errors/friendlyError'
import { es } from '../i18n/es'
import { BatSticker } from '../components/Stickers'
import { PlusIcon, PencilIcon } from '../components/Icons'
import CuteComment from '../components/CuteComment'

export default function PencilTest() {
  const secuencias = useGalleryStore((s) => s.secuencias)
  const addSecuencia = useGalleryStore((s) => s.addSecuencia)
  const updateSecuencia = useGalleryStore((s) => s.updateSecuencia)
  const { token } = useAuth()
  const { state, error: loadError, retry, hasConnectedBefore } = useGalleryData()
  const [files, setFiles] = useState<File[]>([])
  const [fps, setFps] = useState(12)
  const [titulo, setTitulo] = useState('Animación')
  const [playing, setPlaying] = useState(false)
  const [currentSecId, setCurrentSecId] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [urls, setUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sec = secuencias.find((s) => s.id === currentSecId) || secuencias[0]
  const loading = state === 'loading'

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const objUrls: string[] = []
    const frames = sec ? sec.frames.slice().sort((a, b) => a.orden - b.orden) : []
    Promise.all(
      frames.map((f) =>
        downloadFileAsBlob(token, f.drive.galeriaId)
          .then((blob) => {
            if (cancelled) return ''
            const u = URL.createObjectURL(blob)
            objUrls.push(u)
            return u
          })
          .catch(() => ''),
      ),
    ).then((res) => {
      if (cancelled) return
      setUrls(res.filter((x) => x))
      setIndex(0)
    })
    return () => {
      cancelled = true
      for (const u of objUrls) URL.revokeObjectURL(u)
    }
  }, [sec, token])

  useEffect(() => {
    if (!playing || urls.length === 0) return
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % urls.length)
    }, 1000 / Math.min(24, Math.max(6, fps)))
    return () => clearInterval(interval)
  }, [playing, urls, fps])

  function moveFrame(from: number, to: number) {
    if (!sec) return
    const sorted = sec.frames.slice().sort((a, b) => a.orden - b.orden)
    if (to < 0 || to >= sorted.length) return
    const [f] = sorted.splice(from, 1)
    sorted.splice(to, 0, f)
    const frames = sorted.map((fr, i) => ({ ...fr, orden: i }))
    updateSecuencia(sec.id, { frames })
    const latest = useGalleryStore.getState().secuencias.find((s) => s.id === sec.id)
    if (latest) void enqueueSave((saveToken) => saveSecuencia(saveToken, latest)).catch(() => undefined)
  }

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ''
    setFiles(picked)
    setError(null)
  }

  async function createFromFiles() {
    if (files.length === 0 || uploading) return
    setUploading(true)
    setProgress({ done: 0, total: files.length })
    setError(null)
    try {
      const token = await ensureToken()
      if (!isGalleryLoaded()) await ensureLoaded(token)
      const id = ulid()
      const safeFps = Math.min(24, Math.max(6, fps))
      const uploaded = await uploadFrames(
        files,
        { id, titulo: titulo || 'Animación', fps: safeFps },
        (done, total) => setProgress({ done, total }),
      )
      const frames = uploaded.frames.map((u, i) => ({ id: u.id, orden: i, drive: u.drive }))
      const s = withUpdatedAt({
        schema: 1 as const,
        id,
        rev: 1,
        titulo: titulo || 'Animación',
        fps: safeFps,
        bucle: true,
        frames,
        mainFileId: uploaded.mainFileId,
        miniatura: uploaded.frames[0]?.miniDataUrl || '',
        coleccionIds: [],
      })
      addSecuencia(s)
      void enqueueSave((saveToken) => saveSecuencia(saveToken, s)).catch(() => undefined)
      setFiles([])
      setCurrentSecId(s.id)
    } catch (e) {
      console.error('Upload frames failed', e)
      setError(friendlyError(e, es.pencil.uploadError))
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 fade-up">
          <PencilIcon className="hidden sm:block w-7 h-7 shrink-0 text-[var(--accent-soft)]" />
          <h1 className="text-xl sm:text-2xl font-bold gradient-text truncate">Animaciones</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0 fade-up">
          <Link to="/" className="btn btn-soft">
            ← Volver
          </Link>
        </div>
      </header>

      <div className="panel p-4 flex flex-wrap items-center gap-3 fade-up" style={{ animationDelay: '0.08s' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={handlePick}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn btn-soft"
        >
          <PlusIcon className="w-5 h-5" />
          {es.pencil.pick}
        </button>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={es.pencil.titlePlaceholder}
          className="field grow min-w-[10rem]"
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="whitespace-nowrap">{es.pencil.fps}</span>
          <input
            type="number"
            value={fps}
            min={6}
            max={24}
            onChange={(e) => setFps(Number(e.target.value))}
            aria-label={es.pencil.fps}
            className="field w-24"
          />
        </label>
        <button onClick={createFromFiles} disabled={uploading || files.length === 0} className="btn btn-primary">
          {uploading ? es.pencil.creating : es.pencil.createWithCount(files.length)}
        </button>
        <button onClick={() => setPlaying((v) => !v)} disabled={!sec || urls.length === 0} className="btn btn-soft">
          {playing ? es.pencil.pause : es.pencil.play}
        </button>
        {files.length > 0 && <span className="text-sm text-[var(--muted)]">{es.pencil.selected(files.length)}</span>}
      </div>
      {progress && (
        <p className="text-sm text-[var(--muted)]">
          {es.pencil.uploadingFrame(Math.min(progress.done + 1, progress.total), progress.total)}
        </p>
      )}
      {error && <p className="text-sm text-[#ff9db1]">{error}</p>}

      {state === 'error' && (
        <div className="panel p-4 text-center flex flex-col items-center gap-3">
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

      {loading ? (
        <div className="flex flex-col items-center text-center gap-3 py-10">
          <img
            src="./icon.png"
            alt=""
            aria-hidden="true"
            className="w-20 h-20 sticker-shadow sticker-float hop object-contain"
          />
          <p className="text-sm text-[var(--muted)]">Revisando animaciones...</p>
        </div>
      ) : sec && urls.length > 0 ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-full max-w-3xl aspect-[4/3] bg-black border-2 border-[var(--border)] rounded-2xl overflow-hidden shadow-lg">
            {urls[index % urls.length] && (
              <img
                src={urls[index % urls.length]}
                alt={es.pencil.currentFrame}
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
          </div>
          <p className="text-sm text-[var(--muted)]">
            {es.pencil.frameOf((index % urls.length) + 1, urls.length)}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {sec.frames
              .slice()
              .sort((a, b) => a.orden - b.orden)
              .map((f, i) => (
                <div key={f.id} className="flex flex-col items-center gap-1">
                  <div className="sticker-frame">
                    <img src={urls[i]} alt={es.pencil.frameAlt(i + 1)} className="w-20 h-16 object-cover" />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveFrame(i, i - 1)}
                      disabled={i === 0}
                      aria-label={es.pencil.moveBack}
                      className="btn btn-soft"
                    >
                      ◀
                    </button>
                    <button
                      onClick={() => moveFrame(i, i + 1)}
                      disabled={i === sec.frames.length - 1}
                      aria-label={es.pencil.moveForward}
                      className="btn btn-soft"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              ))}
          </div>
          {secuencias.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={currentSecId || sec?.id || ''}
                onChange={(e) => {
                  setCurrentSecId(e.target.value)
                  setPlaying(false)
                  setIndex(0)
                }}
                className="field"
              >
                <option value="">Seleccionar animación...</option>
                {secuencias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titulo}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const id = currentSecId || sec?.id
                  if (id) {
                    setCurrentSecId(id)
                    setPlaying(true)
                  }
                }}
                disabled={!currentSecId && !sec}
                className="btn btn-soft"
              >
                Reproducir
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center gap-3 py-10">
          <BatSticker className="w-20 sticker-float sticker-shadow pop-in" />
          <p className="text-sm text-[var(--muted)] max-w-xs">{es.pencil.empty}</p>
        </div>
      )}
      <CuteComment />
    </div>
  )
}
