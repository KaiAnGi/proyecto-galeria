import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { es } from '../../i18n/es'

export type StageBackground = 'checker' | 'black' | 'white'

interface AnimationStageProps {
  current?: HTMLImageElement
  previous?: HTMLImageElement
  next?: HTMLImageElement
  status: 'ready' | 'loading' | 'error' | 'empty'
  showOnion: boolean
  onionPrevious: boolean
  onionNext: boolean
  onionOpacity: number
  background: StageBackground
  label: string
  resetSignal?: number
  onRetry?: () => void
}

interface ViewState {
  zoom: number
  x: number
  y: number
}

const MIN_ZOOM = 1
const MAX_ZOOM = 8
const INITIAL_VIEW: ViewState = { zoom: 1, x: 0, y: 0 }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export default function AnimationStage({
  current,
  previous,
  next,
  status,
  showOnion,
  onionPrevious,
  onionNext,
  onionOpacity,
  background,
  label,
  resetSignal = 0,
  onRetry,
}: AnimationStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tintCache = useRef(new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>())
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const panRef = useRef<{ lastX: number; lastY: number } | null>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const viewRef = useRef<ViewState>(INITIAL_VIEW)
  const [view, setView] = useState<ViewState>(INITIAL_VIEW)
  const [seenResetSignal, setSeenResetSignal] = useState(resetSignal)
  const [size, setSize] = useState({ width: 0, height: 0 })

  if (resetSignal !== seenResetSignal) {
    setSeenResetSignal(resetSignal)
    setView(INITIAL_VIEW)
  }

  useEffect(() => {
    viewRef.current = view
  }, [view])

  const resetView = useCallback(() => setView(INITIAL_VIEW), [])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const tint = useCallback((image: HTMLImageElement, color: string): HTMLCanvasElement | HTMLImageElement => {
    let colors = tintCache.current.get(image)
    if (!colors) {
      colors = new Map()
      tintCache.current.set(image, colors)
    }
    const cached = colors.get(color)
    if (cached) return cached

    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height) return image

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return image
    context.drawImage(image, 0, 0, width, height)
    context.globalCompositeOperation = 'source-in'
    context.fillStyle = color
    context.fillRect(0, 0, width, height)
    colors.set(color, canvas)
    return canvas
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context || size.width <= 0 || size.height <= 0) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const pixelWidth = Math.round(size.width * dpr)
    const pixelHeight = Math.round(size.height * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, size.width, size.height)

    if (background === 'white') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, size.width, size.height)
    } else if (background === 'black') {
      context.fillStyle = '#000000'
      context.fillRect(0, 0, size.width, size.height)
    }

    if (!current) return

    const naturalWidth = current.naturalWidth || current.width
    const naturalHeight = current.naturalHeight || current.height
    if (!naturalWidth || !naturalHeight) return

    const fit = Math.min(size.width / naturalWidth, size.height / naturalHeight)
    const scale = fit * view.zoom
    const drawWidth = naturalWidth * scale
    const drawHeight = naturalHeight * scale
    const x = (size.width - drawWidth) / 2 + view.x
    const y = (size.height - drawHeight) / 2 + view.y

    const place = (image: HTMLImageElement, color?: string, alpha = 1) => {
      context.globalAlpha = clamp(alpha, 0, 1)
      const source = color ? tint(image, color) : image
      context.drawImage(source, x, y, drawWidth, drawHeight)
      context.globalAlpha = 1
    }

    if (showOnion && previous && onionPrevious) place(previous, '#ff4fa3', onionOpacity)
    if (showOnion && next && onionNext) place(next, '#4fb3ff', onionOpacity)
    place(current)
  }, [
    background,
    current,
    next,
    onionNext,
    onionOpacity,
    onionPrevious,
    previous,
    showOnion,
    size,
    tint,
    view,
  ])

  useEffect(() => {
    draw()
  }, [draw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const offsetX = event.clientX - rect.left - rect.width / 2
      const offsetY = event.clientY - rect.top - rect.height / 2
      const factor = Math.exp(-event.deltaY * 0.0015)
      setView((currentView) => {
        const zoom = clamp(currentView.zoom * factor, MIN_ZOOM, MAX_ZOOM)
        const ratio = zoom / currentView.zoom
        return {
          zoom,
          x: currentView.x * ratio - offsetX * (ratio - 1),
          y: currentView.y * ratio - offsetY * (ratio - 1),
        }
      })
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointersRef.current.size === 1) {
      panRef.current = { lastX: event.clientX, lastY: event.clientY }
      pinchRef.current = null
    } else if (pointersRef.current.size === 2) {
      panRef.current = null
      const [first, second] = [...pointersRef.current.values()]
      pinchRef.current = { distance: distance(first, second), zoom: viewRef.current.zoom }
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [first, second] = [...pointersRef.current.values()]
      const nextDistance = distance(first, second)
      if (pinchRef.current.distance > 0) {
        const zoom = clamp(
          pinchRef.current.zoom * (nextDistance / pinchRef.current.distance),
          MIN_ZOOM,
          MAX_ZOOM,
        )
        setView((currentView) => ({ ...currentView, zoom }))
      }
      return
    }

    const pan = panRef.current
    if (!pan || viewRef.current.zoom <= 1) return
    const deltaX = event.clientX - pan.lastX
    const deltaY = event.clientY - pan.lastY
    panRef.current = { lastX: event.clientX, lastY: event.clientY }
    if (deltaX === 0 && deltaY === 0) return
    setView((currentView) => ({ ...currentView, x: currentView.x + deltaX, y: currentView.y + deltaY }))
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    pointersRef.current.delete(event.pointerId)

    if (pointersRef.current.size === 0) {
      panRef.current = null
      pinchRef.current = null
    } else if (pointersRef.current.size === 1) {
      const [remaining] = [...pointersRef.current.values()]
      panRef.current = { lastX: remaining.x, lastY: remaining.y }
      pinchRef.current = null
    }

    if (pointersRef.current.size > 0) return

    const now = Date.now()
    const lastTap = lastTapRef.current
    if (!lastTap || now - lastTap.time > 320 || distance(lastTap, { x: event.clientX, y: event.clientY }) > 28) {
      lastTapRef.current = { time: now, x: event.clientX, y: event.clientY }
    } else {
      lastTapRef.current = null
      resetView()
    }
  }

  function zoomBy(factor: number) {
    setView((currentView) => ({
      ...currentView,
      zoom: clamp(currentView.zoom * factor, MIN_ZOOM, MAX_ZOOM),
    }))
  }

  const zoomPercent = Math.round(view.zoom * 100)

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={label}
      className={`stage relative mx-auto h-[clamp(260px,52dvh,620px)] w-full max-w-4xl overflow-hidden rounded-2xl border-2 border-[var(--border)] shadow-lg ${
        background === 'checker' ? 'stage-checker' : background === 'white' ? 'bg-white' : 'bg-black'
      }`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="h-full w-full touch-none"
        style={{ cursor: view.zoom > 1 ? 'grab' : 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {status !== 'ready' && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[var(--muted)]">
          {status === 'error' ? (
            <>
              <p>{es.pencil.loadFramesError}</p>
              {onRetry && (
                <button type="button" onClick={onRetry} className="btn btn-soft pointer-events-auto">
                  {es.pencil.retryFrame}
                </button>
              )}
            </>
          ) : status === 'empty' ? (
            <p>{es.pencil.emptyStage}</p>
          ) : (
            <p>{es.pencil.loadingFrame}</p>
          )}
        </div>
      )}

      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 p-1 text-white backdrop-blur">
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.35)}
          disabled={view.zoom <= MIN_ZOOM}
          aria-label={es.pencil.zoomOut}
          className="btn btn-ghost min-h-11 min-w-11 px-0 text-white"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label={es.pencil.zoomReset}
          className="min-h-11 min-w-14 rounded-full px-1 text-xs font-semibold"
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1.35)}
          disabled={view.zoom >= MAX_ZOOM}
          aria-label={es.pencil.zoomIn}
          className="btn btn-ghost min-h-11 min-w-11 px-0 text-white"
        >
          +
        </button>
      </div>
    </div>
  )
}
