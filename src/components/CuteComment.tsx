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
    const key = `cute-comment-${location.pathname}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const t1 = setTimeout(() => setVisible(true), delay)
    const t2 = setTimeout(() => setVisible(false), delay + duration)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [delay, duration])

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-end gap-2 max-w-[90vw] sm:max-w-sm animate-[fadeIn_.3s_ease]">
      <img src={comment.icon} alt="" className="w-16 h-16 sm:w-20 sm:h-20 sticker-shadow shrink-0" />
      <div className="relative bg-[var(--panel)] border-2 border-[var(--border)] rounded-2xl px-3 py-2 shadow-lg">
        <div className="absolute -left-2 bottom-3 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-[var(--border)]" />
        <div className="absolute -left-[6px] bottom-3 w-0 h-0 border-t-7 border-b-7 border-r-7 border-transparent border-r-[var(--panel)]" />
        <p className="text-sm sm:text-base">{comment.msg}</p>
      </div>
    </div>
  )
}
