export function safeFileName(title: string): string {
  const cleaned = title.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ')
  return cleaned.slice(0, 80) || 'Animación'
}
