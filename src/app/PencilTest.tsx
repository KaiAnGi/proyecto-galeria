import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { ulid } from 'ulidx'
import { getToken } from '../features/auth/googleAuth'
import { saveSecuencia, ensureLoaded } from '../features/gallery/persistence'
import { uploadFrames } from '../features/gallery/pencilUpload'
import { withUpdatedAt } from '../features/gallery/secuencias'
import { downloadFileAsBlob } from '../features/drive/driveImageClient'

export default function PencilTest() {
  const secuencias = useGalleryStore((s) => s.secuencias)
  const addSecuencia = useGalleryStore((s) => s.addSecuencia)
  const updateSecuencia = useGalleryStore((s) => s.updateSecuencia)
  const [files, setFiles] = useState<File[]>([])
  const [fps, setFps] = useState(12)
  const [titulo, setTitulo] = useState('Pencil test')
  const [playing, setPlaying] = useState(false)
  const [onion, setOnion] = useState(0.4)
  const [currentSecId, setCurrentSecId] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [urls, setUrls] = useState<string[]>([])

  const sec = secuencias.find((s) => s.id === currentSecId) || secuencias[0]

  useEffect(() => {
    const token = getToken()
    if (!token) return
    ensureLoaded(token).catch(() => undefined)
  }, [])

  useEffect(() => {
    const token = getToken()
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
  }, [sec])

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
    const token = getToken()
    if (token) saveSecuencia(token, withUpdatedAt({ ...sec, frames })).catch(() => undefined)
  }

  async function createFromFiles() {
    if (files.length === 0) return
    const uploaded = await uploadFrames(files)
    const frames = uploaded.map((u, i) => ({ id: u.id, orden: i, drive: u.drive }))
    const s = withUpdatedAt({
      schema: 1 as const,
      id: ulid(),
      rev: 1,
      titulo: titulo || 'Pencil test',
      fps: Math.min(24, Math.max(6, fps)),
      bucle: true,
      frames,
      miniatura: uploaded[0]?.miniDataUrl || '',
    })
    addSecuencia(s)
    const token = getToken()
    if (token) saveSecuencia(token, s).catch(() => undefined)
    setFiles([])
    setCurrentSecId(s.id)
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pencil Test</h1>
        <Link to="/galeria">Volver</Link>
      </header>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded p-4 flex flex-wrap gap-3">
        <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" className="min-h-[44px] px-3 bg-[var(--bg)] border border-[var(--border)] rounded" />
        <input type="number" value={fps} min={6} max={24} onChange={(e) => setFps(Number(e.target.value))} className="min-h-[44px] px-3 w-20 bg-[var(--bg)] border border-[var(--border)] rounded" />
        <button onClick={createFromFiles} className="min-h-[44px] px-4 bg-[var(--primary)] rounded">Crear</button>
        <button onClick={() => setPlaying((v) => !v)} className="min-h-[44px] px-4 bg-[var(--bg)] border border-[var(--border)] rounded">{playing ? 'Pausar' : 'Reproducir'}</button>
        <label className="flex items-center gap-2">
          <span>Papel cebolla {Math.round(onion * 100)}%</span>
          <input type="range" min={0} max={0.8} step={0.1} value={onion} onChange={(e) => setOnion(Number(e.target.value))} />
        </label>
      </div>

      {sec && urls.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <div className="relative w-full max-w-3xl aspect-[4/3] bg-black border border-[var(--border)] rounded overflow-hidden">
            {urls[(index - 1 + urls.length) % urls.length] && onion > 0 && (
              <img
                src={urls[(index - 1 + urls.length) % urls.length]}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
                style={{ opacity: onion }}
              />
            )}
            {urls[index % urls.length] && (
              <img
                src={urls[index % urls.length]}
                alt="Fotograma actual"
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
          </div>
          <p className="text-sm text-[var(--muted)]">
            Fotograma {(index % urls.length) + 1} de {urls.length}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {sec.frames
              .slice()
              .sort((a, b) => a.orden - b.orden)
              .map((f, i) => (
                <div key={f.id} className="flex flex-col items-center gap-1">
                  <img
                    src={urls[i]}
                    alt={`Fotograma ${i + 1}`}
                    className="w-20 h-16 object-cover bg-black border border-[var(--border)] rounded"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveFrame(i, i - 1)}
                      disabled={i === 0}
                      aria-label="Mover antes"
                      className="min-w-[44px] min-h-[44px] rounded bg-[var(--bg)] border border-[var(--border)] disabled:opacity-40"
                    >
                      ◀
                    </button>
                    <button
                      onClick={() => moveFrame(i, i + 1)}
                      disabled={i === sec.frames.length - 1}
                      aria-label="Mover después"
                      className="min-w-[44px] min-h-[44px] rounded bg-[var(--bg)] border border-[var(--border)] disabled:opacity-40"
                    >
                      ▶
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
