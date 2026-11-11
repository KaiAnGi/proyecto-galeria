import { es } from '../../i18n/es'
import {
  clampHold,
  MAX_HOLD,
  MIN_HOLD,
  type LoopRange,
  type PlaybackMode,
  type PlaybackSpeed,
} from '../../features/gallery/frameTiming'
import { ChevronLeftIcon, ChevronRightIcon, LayersIcon, LoopIcon, PauseIcon, PlayIcon } from '../Icons'

interface PlaybackTransportProps {
  currentIndex: number
  total: number
  playing: boolean
  waiting?: boolean
  loopMode: PlaybackMode
  speed: PlaybackSpeed
  onion: boolean
  onionOpacity: number
  onionPrevious: boolean
  onionNext: boolean
  fps: number
  hold: number
  tick: number
  tickCount: number
  range: LoopRange | null
  disabled?: boolean
  onPrevious: () => void
  onNext: () => void
  onToggle: () => void
  onSeek: (index: number) => void
  onLoopMode: (mode: PlaybackMode) => void
  onSpeed: (speed: PlaybackSpeed) => void
  onOnion: (value: boolean) => void
  onOnionOpacity: (value: number) => void
  onOnionPrevious: (value: boolean) => void
  onOnionNext: (value: boolean) => void
  onFps: (value: number) => void
  onHold: (value: number) => void
  onRange: (range: LoopRange | null) => void
}

function formatSeconds(value: number): string {
  return `${value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`
}

export default function PlaybackTransport({
  currentIndex,
  total,
  playing,
  waiting = false,
  loopMode,
  speed,
  onion,
  onionOpacity,
  onionPrevious,
  onionNext,
  fps,
  hold,
  tick,
  tickCount,
  range,
  disabled = false,
  onPrevious,
  onNext,
  onToggle,
  onSeek,
  onLoopMode,
  onSpeed,
  onOnion,
  onOnionOpacity,
  onOnionPrevious,
  onOnionNext,
  onFps,
  onHold,
  onRange,
}: PlaybackTransportProps) {
  const currentSeconds = tick / Math.max(1, fps)
  const totalSeconds = tickCount / Math.max(1, fps)
  const rangeActive = Boolean(range)

  return (
    <div
      className="sticky bottom-0 z-20 -mx-4 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3 sm:-mx-6 sm:px-6"
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            step={1}
            value={Math.min(currentIndex, Math.max(0, total - 1))}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={disabled || total === 0}
            aria-label={es.pencil.currentFrame}
            className="min-w-0 flex-1 accent-[var(--accent)]"
          />
          <span className="shrink-0 text-xs text-[var(--muted)] sm:text-sm">
            {formatSeconds(currentSeconds)} / {formatSeconds(totalSeconds)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={disabled || total === 0}
            aria-label={es.pencil.previous}
            className="btn btn-soft min-h-11 min-w-11 px-2"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled || total === 0}
            aria-label={playing ? es.pencil.pause : es.pencil.play}
            className="btn btn-primary min-h-11 min-w-11 px-3"
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={disabled || total === 0}
            aria-label={es.pencil.next}
            className="btn btn-soft min-h-11 min-w-11 px-2"
          >
            <ChevronRightIcon />
          </button>

          <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1">
            <button
              type="button"
              onClick={() => onHold(clampHold(hold - 1))}
              disabled={disabled || hold <= MIN_HOLD}
              aria-label={es.pencil.holdLess}
              className="min-h-11 min-w-11 rounded-full text-lg"
            >
              −
            </button>
            <span className="min-w-10 text-center text-xs font-semibold" aria-label={es.pencil.hold}>
              {es.pencil.holdShort(hold)}
            </span>
            <button
              type="button"
              onClick={() => onHold(clampHold(hold + 1))}
              disabled={disabled || hold >= MAX_HOLD}
              aria-label={es.pencil.holdMore}
              className="min-h-11 min-w-11 rounded-full text-lg"
            >
              +
            </button>
          </div>

          <span className="min-w-24 text-center text-sm text-[var(--muted)]">
            {total > 0 ? es.pencil.frameOf(currentIndex + 1, total) : es.pencil.frameOf(0, 0)}
          </span>

          <button
            type="button"
            onClick={() => onLoopMode(loopMode === 'once' ? 'loop' : 'once')}
            disabled={disabled}
            aria-pressed={loopMode !== 'once'}
            className={`btn min-h-11 ${loopMode !== 'once' ? 'btn-primary' : 'btn-soft'}`}
          >
            <LoopIcon className="h-5 w-5" />
            {es.pencil.loop}
          </button>
          <button
            type="button"
            onClick={() => onLoopMode(loopMode === 'pingpong' ? 'loop' : 'pingpong')}
            disabled={disabled}
            aria-pressed={loopMode === 'pingpong'}
            className={`btn min-h-11 ${loopMode === 'pingpong' ? 'btn-primary' : 'btn-soft'}`}
          >
            ↔ {es.pencil.pingPong}
          </button>

          <div className="flex items-center gap-1" role="group" aria-label={es.pencil.speed}>
            {([0.5, 1, 2] as PlaybackSpeed[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onSpeed(value)}
                disabled={disabled}
                aria-pressed={speed === value}
                className={`min-h-11 min-w-11 rounded-full px-2 text-xs ${
                  speed === value ? 'bg-[var(--accent)] text-white' : 'bg-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {value}x
              </button>
            ))}
          </div>

          <details className="relative">
            <summary className="btn btn-soft min-h-11 cursor-pointer list-none">
              <LayersIcon className="h-5 w-5" />
              {es.pencil.onionSettings}
            </summary>
            <div className="popover popover-up right-0 w-64">
              <p className="text-sm font-semibold">{es.pencil.onionOptions}</p>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={onionPrevious}
                  onChange={(event) => onOnionPrevious(event.target.checked)}
                  disabled={!onion}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                {es.pencil.onionPrevious}
              </label>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={onionNext}
                  onChange={(event) => onOnionNext(event.target.checked)}
                  disabled={!onion}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                {es.pencil.onionNext}
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{es.pencil.onionOpacity}</span>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={Math.round(onionOpacity * 100)}
                  onChange={(event) => onOnionOpacity(Number(event.target.value) / 100)}
                  disabled={!onion}
                  className="accent-[var(--accent)]"
                />
              </label>
            </div>
          </details>

          <details className="relative">
            <summary className="btn btn-soft min-h-11 cursor-pointer list-none">
              {range ? es.pencil.rangeActive(range.start + 1, range.end + 1) : es.pencil.range}
            </summary>
            <div className="popover popover-up right-0 w-64">
              <p className="text-sm font-semibold">{es.pencil.rangeTitle}</p>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rangeActive}
                  onChange={(event) =>
                    onRange(
                      event.target.checked
                        ? { start: 0, end: Math.max(0, Math.min(total - 1, total - 2)) }
                        : null,
                    )
                  }
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                {es.pencil.rangeEnable}
              </label>
              {range && (
                <div className="flex items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span>{es.pencil.rangeStart}</span>
                    <input
                      type="number"
                      min={1}
                      max={range.end + 1}
                      value={range.start + 1}
                      onChange={(event) =>
                        onRange({ start: Number(event.target.value) - 1, end: range.end })
                      }
                      className="field w-16"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span>{es.pencil.rangeEnd}</span>
                    <input
                      type="number"
                      min={range.start + 1}
                      max={total}
                      value={range.end + 1}
                      onChange={(event) =>
                        onRange({ start: range.start, end: Number(event.target.value) - 1 })
                      }
                      className="field w-16"
                    />
                  </label>
                  <button type="button" onClick={() => onRange(null)} className="btn btn-soft min-h-11 text-xs">
                    {es.pencil.rangeAll}
                  </button>
                </div>
              )}
            </div>
          </details>

          <button
            type="button"
            onClick={() => onOnion(!onion)}
            disabled={disabled}
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
              disabled={disabled}
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
                disabled={disabled}
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

        {waiting && (
          <p role="status" className="text-center text-xs text-[var(--accent-soft)]">
            {es.pencil.waitingFrame}
          </p>
        )}
      </div>
    </div>
  )
}
