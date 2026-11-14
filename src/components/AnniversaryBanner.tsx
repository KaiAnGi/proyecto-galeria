import { useState } from 'react'
import { daysTogether, specialDay } from '../features/romance/dates'
import { es } from '../i18n/es'
import { HeartSticker } from './Stickers'

export default function AnniversaryBanner() {
  const [now] = useState(() => new Date())
  const kind = specialDay(now)
  if (!kind) return null

  const title =
    kind === 'birthday-partner'
      ? es.romance.banner.birthdayPartnerTitle
      : kind === 'birthday-author'
        ? es.romance.banner.birthdayAuthorTitle
        : kind === 'anniversary'
          ? es.romance.banner.anniversaryTitle
          : es.romance.banner.monthiversaryTitle

  const body =
    kind === 'birthday-partner'
      ? es.romance.banner.birthdayPartnerBody
      : kind === 'birthday-author'
        ? es.romance.banner.birthdayAuthorBody
        : kind === 'anniversary'
          ? es.romance.banner.anniversaryBody(daysTogether(now))
          : es.romance.banner.monthiversaryBody(daysTogether(now))

  return (
    <aside
      role="status"
      className="w-full max-w-xl overflow-hidden rounded-3xl border-2 border-[var(--accent)] px-4 py-4 text-center shadow-lg fade-up"
      style={{
        backgroundImage:
          'linear-gradient(135deg, rgba(255, 79, 163, 0.28), rgba(123, 63, 184, 0.32))',
      }}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <HeartSticker className="h-6 w-6 shrink-0" />
        <p className="font-display text-lg sm:text-xl">{title}</p>
        <HeartSticker className="h-6 w-6 shrink-0" />
      </div>
      <p className="mt-1 text-sm text-[var(--text)]/85">{body}</p>
    </aside>
  )
}
