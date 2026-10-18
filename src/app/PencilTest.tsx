import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import { ulid } from 'ulidx'

export default function PencilTest() {
  const secuencias = useGalleryStore((s) => s.secuencias)
  const addSecuencia = useGalleryStore((s) => s.addSecuencia)
  const [files, setFiles] = useState<File[]>([])
  const [fps, setFps] = useState(12)
  const [titulo, setTitulo] = useState('Pencil test')
  const [playing, setPlaying] = useState(false)
  const [onion, setOnion] = useState(0.4)
  const canvasPrevRef = useRef<HTMLCanvasElement>(null)
  const canvasCurrRef = useRef<HTMLCanvasElement>(null)

  async function createFromFiles() {
    if (files.length === 0) return
    const frames: any[] = []
    for (let i = 0; i < files.length; i++) {
      frames.push({
        id: ulid(),
        orden: i,
        drive: { originalId: `local-${i}`, galeriaId: `local-${i}` },
      })
    }
    addSecuencia({
      schema: 1,
      id: ulid(),
      rev: 1,
      updatedAt: new Date().toISOString(),
      titulo: titulo || 'Pencil test',
      fps: Math.min(24, Math.max(6, fps)),
      bucle: true,
      frames,
      miniatura: '',
    })
    setFiles([])
  }

  useEffect(() => {
    if (!playing || secuencias.length === 0) return
    const interval = setInterval(() => {
      // placeholder: no-op para mantener lógica mínima
    }, 1000 / Math.min(24, Math.max(6, fps)))
    return () => clearInterval(interval)
  }, [playing, secuencias, fps])

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

      {secuencias[0] && secuencias[0].frames.length > 0 && (
        <div className="flex gap-4">
          <canvas ref={canvasPrevRef} width={640} height={480} className="bg-black border border-[var(--border)]" style={{ opacity: onion }} />
          <canvas ref={canvasCurrRef} width={640} height={480} className="bg-black border border-[var(--border)]" />
        </div>
      )}
    </div>
  )
}
