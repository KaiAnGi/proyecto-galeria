import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ulid } from 'ulidx'
import { createDraftFromFiles, useSequenceDrafts } from '../../features/gallery/sequenceDrafts'
import { friendlyError } from '../../lib/errors/friendlyError'
import { es } from '../../i18n/es'
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, ImagesIcon, PlusIcon, TrashIcon } from '../Icons'

interface SelectedFile {
  key: string
  file: File
  url: string
}

interface NewAnimationPanelProps {
  onCreated: (sequenceId: string) => void
  onClose: () => void
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)
}

export default function NewAnimationPanel({ onCreated, onClose }: NewAnimationPanelProps) {
  const putDraft = useSequenceDrafts((state) => state.putDraft)
  const [files, setFiles] = useState<SelectedFile[]>([])
  const [titulo, setTitulo] = useState<string>(es.pencil.defaultTitle)
  const [fps, setFps] = useState(12)
  const [preparing, setPreparing] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const urlsRef = useRef(new Set<string>())

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
      urls.clear()
    }
  }, [])

  const addFiles = useCallback((list: File[]) => {
    const images = list.filter(isImage)
    if (images.length === 0) return
    setFiles((current) => [
      ...current,
      ...images.map((file) => {
        const url = URL.createObjectURL(file)
        urlsRef.current.add(url)
        return { key: ulid(), file, url }
      }),
    ])
    setError(null)
  }, [])

  useEffect(() => {
    const onPaste = (event: globalThis.ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.files ?? [])
      if (pasted.length > 0) addFiles(pasted)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addFiles])

  function removeFile(key: string) {
    setFiles((current) => {
      const target = current.find((item) => item.key === key)
      if (target) {
        URL.revokeObjectURL(target.url)
        urlsRef.current.delete(target.url)
      }
      return current.filter((item) => item.key !== key)
    })
  }

  function moveFile(index: number, direction: -1 | 1) {
    const target = index + direction
    setFiles((current) => {
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    addFiles(Array.from(event.dataTransfer.files))
  }

  async function prepare() {
    if (files.length === 0 || preparing) return
    setPreparing(true)
    setProgress({ done: 0, total: files.length })
    setError(null)
    try {
      const safeFps = Number.isFinite(fps) ? Math.min(24, Math.max(6, fps)) : 12
      const safeTitle = titulo.trim() || es.pencil.defaultTitle
      const draft = await createDraftFromFiles(
        files.map((item) => item.file),
        { titulo: safeTitle, fps: safeFps },
        (done, total) => setProgress({ done, total }),
      )
      putDraft(draft)
      onCreated(draft.id)
    } catch (e) {
      console.error('Prepare animation failed', e)
      setError(friendlyError(e, es.pencil.prepareError))
    } finally {
      setPreparing(false)
      setProgress(null)
    }
  }

  return (
    <section className="panel p-4 sm:p-5 flex flex-col gap-4 fade-up" aria-label={es.pencil.createTitle}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{es.pencil.createTitle}</h2>
          <p className="text-sm text-[var(--muted)]">{es.pencil.createHint}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={preparing}
          aria-label={es.app.dismiss}
          className="min-w-11 min-h-11 rounded-full text-[var(--muted)]"
        >
          ✕
        </button>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${
          dragging ? 'border-[var(--accent)] bg-[var(--surface)]' : 'border-[var(--border)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={preparing}
          onChange={handlePick}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          disabled={preparing}
          onChange={handlePick}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={preparing}
            className="btn btn-soft"
          >
            <ImagesIcon className="w-5 h-5" />
            {es.pencil.pick}
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={preparing}
            className="btn btn-soft"
          >
            <CameraIcon className="w-5 h-5" />
            {es.pencil.addFromCamera}
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">{es.pencil.dropHint}</p>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">{es.pencil.selected(files.length)}</p>
          <ol className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {files.map((item, index) => (
              <li key={item.key} className="flex flex-col gap-1">
                <div className="sticker-frame relative">
                  <img
                    src={item.url}
                    alt={es.pencil.frameAlt(index + 1)}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                    {index + 1}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveFile(index, -1)}
                      disabled={index === 0 || preparing}
                      aria-label={es.pencil.moveBack}
                      className="btn btn-soft min-w-11 min-h-11 px-2"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveFile(index, 1)}
                      disabled={index === files.length - 1 || preparing}
                      aria-label={es.pencil.moveForward}
                      className="btn btn-soft min-w-11 min-h-11 px-2"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(item.key)}
                    disabled={preparing}
                    aria-label={es.pencil.removeSelected}
                    className="btn btn-soft min-w-11 min-h-11 px-2"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 grow min-w-[12rem]">
          <span className="text-sm text-[var(--muted)]">{es.pencil.titleLabel}</span>
          <input
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder={es.pencil.titlePlaceholder}
            className="field"
            disabled={preparing}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[var(--muted)]">{es.pencil.fps}</span>
          <input
            type="number"
            value={fps}
            min={6}
            max={24}
            onChange={(event) => setFps(Number(event.target.value))}
            className="field w-24"
            disabled={preparing}
          />
        </label>
        <button
          type="button"
          onClick={() => void prepare()}
          disabled={preparing || files.length === 0}
          className="btn btn-primary"
        >
          <PlusIcon className="w-5 h-5" />
          {preparing ? es.pencil.preparing : es.pencil.createWithCount(files.length)}
        </button>
      </div>

      {progress && (
        <div role="status" className="flex flex-col gap-2">
          <p className="text-sm text-[var(--muted)]">
            {es.pencil.preparingFrame(Math.min(progress.done + 1, progress.total), progress.total)}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width]"
              style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-[#ff9db1]">{error}</p>}
    </section>
  )
}
