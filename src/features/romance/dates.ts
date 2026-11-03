export const RELATIONSHIP_START = { year: 2026, month: 10, day: 14 } as const
export const PARTNER_BIRTHDAY = { month: 8, day: 6 } as const
export const AUTHOR_BIRTHDAY = { month: 9, day: 2 } as const
export const MONTHIVERSARY_DAY = 14

export type SpecialDay = 'monthiversary' | 'birthday-partner' | 'birthday-author'

function dayStamp(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

export function daysBetween(start: Date, end: Date): number {
  return Math.round((dayStamp(end) - dayStamp(start)) / 86400000)
}

export function relationshipStartDate(): Date {
  return new Date(RELATIONSHIP_START.year, RELATIONSHIP_START.month - 1, RELATIONSHIP_START.day)
}

export function daysTogether(now = new Date()): number {
  return Math.max(0, daysBetween(relationshipStartDate(), now))
}

function dateOnDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, lastDay))
}

export function partnerBirthday(year?: number): Date {
  const y = year ?? new Date().getFullYear()
  return dateOnDay(y, PARTNER_BIRTHDAY.month - 1, PARTNER_BIRTHDAY.day)
}

export function authorBirthday(year?: number): Date {
  const y = year ?? new Date().getFullYear()
  return dateOnDay(y, AUTHOR_BIRTHDAY.month - 1, AUTHOR_BIRTHDAY.day)
}

export function nextMonthiversary(now = new Date(), day = MONTHIVERSARY_DAY): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thisMonth = dateOnDay(today.getFullYear(), today.getMonth(), day)
  if (thisMonth.getTime() > today.getTime()) return thisMonth
  return dateOnDay(today.getFullYear(), today.getMonth() + 1, day)
}

export function daysUntilNextMonthiversary(now = new Date()): number {
  return daysBetween(now, nextMonthiversary(now))
}

export function isMonthiversary(now = new Date()): boolean {
  return now.getDate() === MONTHIVERSARY_DAY
}

export function specialDay(now = new Date()): SpecialDay | null {
  const month = now.getMonth() + 1
  const day = now.getDate()
  if (month === PARTNER_BIRTHDAY.month && day === PARTNER_BIRTHDAY.day) return 'birthday-partner'
  if (month === AUTHOR_BIRTHDAY.month && day === AUTHOR_BIRTHDAY.day) return 'birthday-author'
  if (day === MONTHIVERSARY_DAY) return 'monthiversary'
  return null
}
