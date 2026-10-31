import { es } from '../../i18n/es'
import { ChevronLeftIcon, ChevronRightIcon, LayersIcon, LoopIcon, PauseIcon, PlayIcon } from '../Icons'

interface PlaybackTransportProps {
  currentIndex: number
  total: number
  playing: boolean
  loop: boolean
  onion: boolean
  fps: number
  onPrevious: () => void
  onNext: () => void
  onToggle: () => void
  onSeek: (index: number) => void
  onLoop: (value: boolean) => void
  onOnion: (value: boolean) => void
  onFps: (value: number) => void
}

export default function PlaybackTransport({
  currentIndex,
  total,
  playing,
  loop,
  onion,
  fps,
  onPrevious,
  onNext,
  onToggle,
  onSeek,
  onLoop,
  onOnion,
  onFps,
}: PlaybackTransportProps) {
  return (
    <div
      className="sticky bottom-0 z-20 -mx-4 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3 sm:-mx-6 sm:px-6"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          step={1}
          value={Math.min(currentIndex, Math.max(0, total - 1))}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={total === 0}
          aria-label={es.pencil.currentFrame}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={total === 0}
            aria-label={es.pencil.previous}
            className="btn btn-soft min-h-11 min-w-11 px-2"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={total === 0}
            aria-label={playing ? es.pencil.pause : es.pencil.play}
            className="btn btn-primary min-h-11 min-w-11 px-3"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={total === 0}
            aria-label={es.pencil.next}
            className="btn btn-soft min-h-11 min-w-11 px-2"
          >
            <ChevronRightIcon />
          </button>
          <span className="min-w-24 text-center text-sm text-[var(--muted)]">
            {total > 0 ? es.pencil.frameOf(currentIndex + 1, total) : es.pencil.frameOf(0, 0)}
          </span>
          <button
            type="button"
            onClick={() => onLoop(!loop)}
            aria-pressed={loop}
            className={`btn min-h-11 ${loop ? 'btn-primary' : 'btn-soft'}`}
          >
            <LoopIcon className="h-5 w-5" />
            {es.pencil.loop}
          </button>
          <button
            type="button"
            onClick={() => onOnion(!onion)}
            aria-pressed={onion}
            className={`btn min-h-11 ${onion ? 'btn-primary' : 'btn-soft'}`}
          >
            <LayersIcon className="h-5 w-5" />
            {es.pencil.onion}
          </button>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <span className="whitespace-nowrap">{es.pencil.fpsShort(fps)}</span>
            <input
              type="range"
              min={6}
              max={24}
              step={1}
              value={fps}
              onChange={(event) => onFps(Number(event.target.value))}
              aria-label={es.pencil.fps}
              className="w-20 accent-[var(--accent)]"
            />
          </label>
          <div className="flex items-center gap-1">
            {[8, 12, 16, 24].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onFps(preset)}
                aria-pressed={fps === preset}
                aria-label={es.pencil.fpsShort(preset)}
                className={`min-h-11 min-w-11 rounded-full px-2 text-xs ${
                  fps === preset ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
