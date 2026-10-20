export function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const set = new Set(dates.map((d) => d.slice(0, 10)))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let streak = 0
  let current = new Date(today)
  for (let i = 0; i < 365; i++) {
    const key = current.toISOString().slice(0, 10)
    if (set.has(key)) {
      streak++
      current.setDate(current.getDate() - 1)
    } else {
      if (i === 0 && !set.has(key)) {
        current.setDate(current.getDate() - 1)
        continue
      }
      break
    }
  }
  return streak
}

export function totalDrawings(dates: string[]): number {
  return dates.length
}

export function lastActiveDays(dates: string[], n = 7): string[] {
  const set = new Set(dates.map((d) => d.slice(0, 10)))
  const res: string[] = []
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const c = new Date(d)
    c.setDate(d.getDate() - i)
    res.push(c.toISOString().slice(0, 10))
  }
  return res.map((k) => (set.has(k) ? k : ''))
}
