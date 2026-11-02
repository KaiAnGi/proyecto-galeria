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

export default function CuteComment({ delay = 400, duration = 3500 }: Props) {
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
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-end gap-3 px-3 pb-3 sm:gap-4 sm:px-4 sm:pb-4 pop-in">
      <img src={comment.icon} alt="" className="w-24 h-24 sm:w-28 sm:h-28 sticker-shadow shrink-0" />
      <div className="relative flex-1 min-w-0 bg-[var(--surface)] border-2 border-[var(--border)] rounded-2xl px-4 py-3 shadow-lg sm:px-5 sm:py-4">
        <div className="absolute -left-2 bottom-4 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-[var(--border)]" />
        <div className="absolute -left-[6px] bottom-4 w-0 h-0 border-t-7 border-b-7 border-r-7 border-transparent border-r-[var(--surface)]" />
        <p className="text-base sm:text-lg md:text-xl font-medium">{comment.msg}</p>
      </div>
    </div>
  )
}
