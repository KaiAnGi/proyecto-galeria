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
    <div className="panel mt-1 flex flex-col items-center gap-1 px-4 py-3 text-center fade-up" style={{ animationDelay: '0.06s' }}>
      <p className="text-xs text-[var(--muted)]">
        {es.romance.togetherSince(longDate.format(relationshipStartDate()))}
      </p>
      <p className="font-display text-lg">{es.romance.daysTogether(days)}</p>
      <p className="text-xs text-[var(--muted)]">
        {isMonthiversary(now) ? es.romance.monthiversaryToday : es.romance.nextMonthiversary(countdown)}
      </p>
    </div>
  )
}
