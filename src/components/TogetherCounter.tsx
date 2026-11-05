import { useState } from 'react'
import {
  daysTogether,
  daysUntilNextMonthiversary,
  isMonthiversary,
  relationshipStartDate,
} from '../features/romance/dates'
import { es } from '../i18n/es'

const longDate = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function TogetherCounter() {
  const [now] = useState(() => new Date())
  const days = daysTogether(now)
  const countdown = daysUntilNextMonthiversary(now)

  return (
    <div
      className="panel mt-1 flex flex-col items-center gap-0.5 px-3 py-1.5 text-center fade-up sm:gap-1 sm:px-4 sm:py-3"
      style={{ animationDelay: '0.06s' }}
    >
      <p className="hidden text-xs text-[var(--muted)] sm:block">
        {es.romance.togetherSince(longDate.format(relationshipStartDate()))}
      </p>
      <p className="font-display text-base text-[var(--accent)] sm:text-lg">
        {es.romance.daysTogether(days)}
      </p>
      <p className="text-[10px] text-[var(--muted)] sm:text-xs">
        {isMonthiversary(now) ? es.romance.monthiversaryToday : es.romance.nextMonthiversary(countdown)}
      </p>
    </div>
  )
}
