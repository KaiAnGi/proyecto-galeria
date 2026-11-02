import { useEffect, useRef } from 'react'
import { es } from '../i18n/es'
import { HeartSticker, StarSticker } from './Stickers'

type Props = {
  open: boolean
  onClose: () => void
}

export default function HiddenLetter({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="love-letter-title"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-6"
    >
      <article
        onClick={(event) => event.stopPropagation()}
        className="love-letter letter-open relative my-auto w-full max-w-lg px-6 py-8 text-[#4a2438] sm:px-10 sm:py-10"
      >
        <HeartSticker className="absolute -right-3 -top-4 h-10 w-10 sticker-shadow" />
        <StarSticker className="absolute -left-3 bottom-4 h-6 w-6 opacity-80" />
        <p className="text-xs uppercase tracking-[0.25em] text-[#a1567b]">{es.romance.letter.kicker}</p>
        <h2 id="love-letter-title" className="mt-1 font-display text-3xl font-bold text-[#7b2f55]">
          {es.romance.letter.title}
        </h2>
        <p className="mt-4 font-semibold">{es.romance.letter.greeting}</p>
        <p className="mt-2 leading-7">{es.romance.letter.body}</p>
        <p className="mt-5 whitespace-pre-line text-right italic">{es.romance.letter.signature}</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="btn btn-accent mt-6 w-full"
        >
          {es.romance.letter.close}
        </button>
      </article>
    </div>
  )
}
