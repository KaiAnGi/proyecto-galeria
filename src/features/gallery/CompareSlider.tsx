import { useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { es } from '../../i18n/es'

interface Props {
  srcBefore: string
  srcAfter: string
  altBefore: string
  altAfter: string
}

export default function CompareSlider({ srcBefore, srcAfter, altBefore, altAfter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50)
  const dragging = useRef(false)

  function updateFromClientX(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.min(100, Math.max(0, pct)))
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromClientX(e.clientX)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    updateFromClientX(e.clientX)
  }

  function onPointerUp() {
    dragging.current = false
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    let next: number | null = null
    if (e.key === 'ArrowLeft') next = pos - 4
    if (e.key === 'ArrowRight') next = pos + 4
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = 100
    if (next === null) return
    e.preventDefault()
    setPos(Math.min(100, Math.max(0, next)))
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative overflow-hidden bg-[var(--surface)] rounded-lg border border-[var(--border)] flex items-center justify-center touch-none select-none"
      style={{ minHeight: '50vh', maxHeight: '70vh' }}
    >
      <img src={srcAfter} alt={altAfter} draggable={false} className="max-w-full max-h-[70vh] object-contain" />
      <img
        src={srcBefore}
        alt={altBefore}
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <span className="chip absolute top-2 left-2">{es.versions.before}</span>
      <span className="chip absolute top-2 right-2">{es.versions.after}</span>
      <div
        role="slider"
        tabIndex={0}
        aria-label={es.versions.sliderLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)}%`}
        onKeyDown={onKeyDown}
        className="absolute top-0 bottom-0 -ml-[22px] w-11 cursor-ew-resize flex items-center justify-center outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent)]"
        style={{ left: `${pos}%` }}
      >
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/85" />
        <div className="relative w-11 h-11 rounded-full bg-white text-[var(--accent-deep)] border-2 border-[var(--accent)] grid place-items-center text-lg font-bold shadow">
          ↔
        </div>
      </div>
    </div>
  )
}
