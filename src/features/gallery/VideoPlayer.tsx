import { useRef, useState } from 'react'
import { es } from '../../i18n/es'
import { frameStepSeconds } from '../../lib/media/mediaProcessor'

interface Props {
  src: string
}

const RATES = [0.25, 0.5, 1, 1.5, 2]

export default function VideoPlayer({ src }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play()
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  function changeRate(value: number) {
    setRate(value)
    if (videoRef.current) videoRef.current.playbackRate = value
  }

  function step(direction: 1 | -1) {
    const v = videoRef.current
    if (!v) return
    v.pause()
    setPlaying(false)
    v.currentTime = Math.max(0, v.currentTime + direction * frameStepSeconds(30))
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <video
        ref={videoRef}
        src={src}
        playsInline
        controls
        className="max-h-[60dvh] w-full rounded-2xl border-2 border-[var(--border)] bg-black shadow-lg"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button onClick={togglePlay} className="btn btn-primary">
          {playing ? es.video.pause : es.video.play}
        </button>
        <button onClick={() => step(-1)} aria-label={es.video.stepBack} className="btn btn-soft">
          ⏮
        </button>
        <button onClick={() => step(1)} aria-label={es.video.stepForward} className="btn btn-soft">
          ⏭
        </button>
        <label className="flex items-center gap-2 text-sm">
          <span>{es.video.speed}</span>
          <select value={rate} onChange={(e) => changeRate(Number(e.target.value))} className="field">
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
