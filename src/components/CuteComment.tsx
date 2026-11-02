import { useEffect, useState } from 'react'
import { es } from '../i18n/es'

const CHARACTERS = [
  {
    icons: [
      './icon-kuromi-cherries.png',
      './icon-kuromi-grin.png',
      './icon-kuromi-hearts.png',
      './icon-kuromi-maid.png',
      './icon-kuromi-sleeping.png',
      './icon-kuromi-witch.png',
    ],
    messages: es.cuteComments.kuromi,
  },
  {
    icons: ['./icon-mymelody.png'],
    messages: es.cuteComments.myMelody,
  },
  {
    icons: ['./icon-cinnamoroll.png'],
    messages: es.cuteComments.cinnamoroll,
  },
]

function pickComment() {
  const character = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]
  return {
    icon: character.icons[Math.floor(Math.random() * character.icons.length)],
    msg: character.messages[Math.floor(Math.random() * character.messages.length)],
  }
}

type Props = {
  delay?: number
  duration?: number
}

export default function CuteComment({ delay = 350, duration = 6500 }: Props) {
  const [visible, setVisible] = useState(false)
  const [comment] = useState(pickComment)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), delay)
    const t2 = setTimeout(() => setVisible(false), delay + duration)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [delay, duration])

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-end gap-3 px-3 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] sm:gap-4 sm:px-4 sm:pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pop-in">
      <img
        src={comment.icon}
        alt=""
        className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 drop-shadow-[0_18px_40px_rgba(236,72,153,0.45)] animate-[cute-float_4s_ease-in-out_infinite]"
      />
      <div
        className="relative flex-1 min-w-0 backdrop-blur-xl border-[3px] rounded-3xl px-5 py-4 shadow-[0_40px_90px_-25px_rgba(219,39,119,0.6)] ring-2 ring-white/30 sm:px-6 sm:py-5"
        style={{
          background:
            'radial-gradient(140% 140% at 0% 0%, rgba(255,255,255,0.32) 0%, color-mix(in srgb, var(--surface) 92%, transparent) 62%)',
          borderColor: 'color-mix(in srgb, var(--accent) 55%, var(--border))',
        }}
      >
        <div className="absolute -left-3 bottom-5 w-0 h-0 border-t-[10px] border-b-[10px] border-r-[12px] border-transparent border-r-[color-mix(in_srgb,var(--accent)_55%,var(--border))]" />
        <div
          className="absolute -left-[8px] bottom-5 w-0 h-0 border-t-[9px] border-b-[9px] border-r-[11px] border-transparent"
          style={{
            borderRightColor:
              'color-mix(in srgb, var(--surface) 92%, transparent)',
          }}
        />
        <p className="text-base sm:text-lg md:text-xl font-semibold tracking-tight drop-shadow-[0_1px_10px_rgba(255,255,255,0.25)]">
          {comment.msg}
        </p>
      </div>
      <style>{`
        @keyframes cute-float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
        }
      `}</style>
    </div>
  )
}
