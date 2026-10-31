import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { es } from '../../i18n/es'
import type { FrameMedia } from '../../features/gallery/useSequenceMedia'
import type { Frame } from '../../features/gallery/secuencias'
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, ImagesIcon, TrashIcon } from '../Icons'

interface FrameTimelineProps {
  frames: Frame[]
  currentIndex: number
  media: Record<string, FrameMedia>
  disabled: boolean
  onSelect: (index: number) => void
  onMove: (from: number, to: number) => void
  onDelete: (frame: Frame) => void
  onAddFiles: (files: File[]) => void
}

export default function FrameTimeline({
  frames,
  currentIndex,
  media,
  disabled,
  onSelect,
  onMove,
  onDelete,
  onAddFiles,
}: FrameTimelineProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(new Map<number, HTMLLIElement>())
  const dragRef = useRef<{ index: number; x: number; y: number; active: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)

  useEffect(() => {
    itemsRef.current.get(currentIndex)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [currentIndex])

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    onAddFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function pointerDown(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || disabled) return
    suppressClickRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { index, x: event.clientX, y: event.clientY, active: false }
  }

  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag) return
    if (!drag.active && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return
    drag.active = true
    setDraggingIndex(drag.index)
  }

  function pointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    dragRef.current = null
    setDraggingIndex(null)
    if (!drag?.active) return
    suppressClickRef.current = true
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-frame-index]')
    const target = element ? Number(element.getAttribute('data-frame-index')) : Number.NaN
    if (Number.isInteger(target) && target >= 0 && target < frames.length && target !== drag.index) {
      onMove(drag.index, target)
    }
  }

  function pointerCancel() {
    dragRef.current = null
    setDraggingIndex(null)
  }

  return (
    <section className="flex flex-col gap-3" aria-label={es.pencil.timeline}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{es.pencil.timeline}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={handlePick}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            disabled={disabled}
            onChange={handlePick}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="btn btn-soft"
          >
            <ImagesIcon className="h-5 w-5" />
            {es.pencil.addFrames}
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled}
            className="btn btn-soft"
          >
            <CameraIcon className="h-5 w-5" />
            {es.pencil.captureFrames}
          </button>
        </div>
      </div>

      <ol className="flex snap-x gap-2 overflow-x-auto pb-2">
        {frames.map((frame, index) => {
          const item = media[frame.id]
          const current = index === currentIndex
          return (
            <li
              key={frame.id}
              data-frame-index={index}
              ref={(element) => {
                if (element) itemsRef.current.set(index, element)
                else itemsRef.current.delete(index)
              }}
              className={`relative flex w-24 shrink-0 snap-start flex-col gap-1 rounded-xl p-1 transition-opacity ${
                current ? 'bg-[var(--surface)] ring-2 ring-[var(--accent)]' : ''
              } ${draggingIndex === index ? 'opacity-40' : ''}`}
            >
              <button
                type="button"
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false
                    return
                  }
                  onSelect(index)
                }}
                onPointerDown={(event) => pointerDown(event, index)}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={pointerCancel}
                aria-label={es.pencil.frameAlt(index + 1)}
                aria-current={current ? 'true' : undefined}
                className="sticker-frame relative min-h-11 w-full overflow-hidden"
              >
                {item?.url ? (
                  <img src={item.url} alt="" className="aspect-[4/3] w-full object-cover" draggable={false} />
                ) : (
                  <span className="flex aspect-[4/3] w-full items-center justify-center text-xs text-[var(--muted)]">
                    {item?.status === 'error' ? '!' : '…'}
                  </span>
                )}
                <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                  {index + 1}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(frame)}
                disabled={frames.length <= 1 || disabled}
                aria-label={es.pencil.deleteFrame}
                className="absolute right-1 top-1 z-10 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
              <div className="flex items-center justify-between gap-0.5">
                <button
                  type="button"
                  onClick={() => onMove(index, index - 1)}
                  disabled={index === 0 || disabled}
                  aria-label={es.pencil.moveBack}
                  className="btn btn-soft min-h-11 min-w-11 px-1"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <span className="text-xs text-[var(--muted)]">{index + 1}</span>
                <button
                  type="button"
                  onClick={() => onMove(index, index + 1)}
                  disabled={index === frames.length - 1 || disabled}
                  aria-label={es.pencil.moveForward}
                  className="btn btn-soft min-h-11 min-w-11 px-1"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
