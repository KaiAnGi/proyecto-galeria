import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { es } from '../../i18n/es'

interface Props {
  src: string
  alt: string
}

const MIN_SCALE = 1
const MAX_SCALE = 6

export default function ZoomableImage({ src, alt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map())
  const lastDist = useRef<number | null>(null)
  const lastMid = useRef<{ x: number; y: number } | null>(null)
  const panStart = useRef<{ x: number; y: number } | { null: null }>({ null: null })
  const moved = useRef(false)
  const [expanded, setExpanded] = useState(false)

  function clamp(v: number, min: number, max: number) {
    return Math.min(max, Math.max(min, v))
  }

  function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function pointerMid(a: { x: number; y: number }, b: { x: number; y: number }) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    moved.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values())
      lastDist.current = pointerDistance(a, b)
      lastMid.current = pointerMid(a, b)
      panStart.current = { null: null }
    } else if (pointers.current.size === 1 && scale > 1) {
      panStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size >= 2 && lastDist.current !== null && lastMid.current) {
      moved.current = true
      const [a, b] = Array.from(pointers.current.values())
      const dist = pointerDistance(a, b)
      const mid = pointerMid(a, b)
      const nextScale = clamp((scale * dist) / lastDist.current, MIN_SCALE, MAX_SCALE)
      const dx = mid.x - lastMid.current.x
      const dy = mid.y - lastMid.current.y
      setScale(nextScale)
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
      lastDist.current = dist
      lastMid.current = mid
    } else if (pointers.current.size === 1 && scale > 1 && panStart.current && 'x' in panStart.current) {
      setOffset({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y })
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) {
      lastDist.current = null
      lastMid.current = null
    }
    if (pointers.current.size === 0) {
      panStart.current = { null: null }
      if (scale <= 1.05) resetView()
    }
  }

  function onDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (scale > 1) {
      resetView()
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const cx = e.clientX - rect.left - rect.width / 2
    const cy = e.clientY - rect.top - rect.height / 2
    setScale(3)
    setOffset({ x: -cx * 3, y: -cy * 3 })
  }

  function resetView() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  function closeExpanded() {
    resetView()
    setExpanded(false)
  }

  function openExpanded() {
    if (moved.current) {
      moved.current = false
      return
    }
    if (scale > 1) return
    setExpanded(true)
  }

  useEffect(() => {
    if (!expanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeExpanded()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  if (expanded) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={alt}
        onClick={closeExpanded}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6"
      >
        <button
          type="button"
          onClick={closeExpanded}
          className="btn btn-soft absolute right-3 top-3 z-10 min-h-11"
        >
          {es.app.dismiss}
        </button>
        <div
          ref={containerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
          onClick={(event) => event.stopPropagation()}
          className="relative flex touch-none select-none items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] object-contain sm:max-h-[calc(100dvh-4rem)] sm:max-w-[calc(100vw-4rem)]"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: scale === 1 ? 'transform 0.2s ease' : 'none',
              cursor: scale > 1 ? 'grab' : 'zoom-in',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label={es.gallery.zoomImage}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={openExpanded}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openExpanded()
        }
      }}
      className="flex cursor-zoom-in touch-none select-none items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
      style={{ minHeight: '50vh', maxHeight: '70vh' }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-full max-h-[70vh] object-contain"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transition: scale === 1 ? 'transform 0.2s ease' : 'none',
          cursor: scale > 1 ? 'grab' : 'zoom-in',
        }}
      />
    </div>
  )
}
