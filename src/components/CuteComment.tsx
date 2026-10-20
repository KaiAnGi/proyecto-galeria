import { useEffect, useState } from 'react'

const ICONS = [
  './icon-kuromi-cherries.png',
  './icon-kuromi-grin.png',
  './icon-kuromi-hearts.png',
  './icon-kuromi-maid.png',
  './icon-kuromi-sleeping.png',
  './icon-kuromi-witch.png',
  './icon-mymelody.png',
  './icon-cinnamoroll.png',
]

const MESSAGES = [
  '¡Qué mono!',
  'Esto está precioso <3',
  'Sigue así, me encanta',
  'Te ha quedado genial',
  'Muy chulo...',
  'Ayyy qué cuqui',
  'Me gusta mucho esto',
  'Un poquito más y arte puro',
  'Oye, esto mola',
  'Precioso de verdad',
  'Tienes buen gusto',
  'Se nota que le has puesto cariño',
  'Ay qué bonito',
  'Esto merece un aplauso',
  'Me quedo con este',
]

type Props = {
  delay?: number
  duration?: number
}

export default function CuteComment({ delay = 400, duration = 3500 }: Props) {
  const [visible, setVisible] = useState(false)
  const [icon, setIcon] = useState(ICONS[0])
  const [msg, setMsg] = useState(MESSAGES[0])

  useEffect(() => {
    const key = `cute-comment-${location.pathname}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const randIcon = ICONS[Math.floor(Math.random() * ICONS.length)]
    const randMsg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
    setIcon(randIcon)
    setMsg(randMsg)
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
      <img src={icon} alt="" className="w-16 h-16 sm:w-20 sm:h-20 sticker-shadow shrink-0" />
      <div className="relative bg-[var(--panel)] border-2 border-[var(--border)] rounded-2xl px-3 py-2 shadow-lg">
        <div className="absolute -left-2 bottom-3 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-[var(--border)]" />
        <div className="absolute -left-[6px] bottom-3 w-0 h-0 border-t-7 border-b-7 border-r-7 border-transparent border-r-[var(--panel)]" />
        <p className="text-sm sm:text-base">{msg}</p>
      </div>
    </div>
  )
}
