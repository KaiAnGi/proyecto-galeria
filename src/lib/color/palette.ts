export function extractPalette(img: HTMLImageElement, maxColors = 6): string[] {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  const size = 64
  canvas.width = size
  canvas.height = size
  ctx.drawImage(img, 0, 0, size, size)
  const data = ctx.getImageData(0, 0, size, size).data
  const map = new Map<string, number>()
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 128) continue
    const qr = Math.round(r / 32) * 32
    const qg = Math.round(g / 32) * 32
    const qb = Math.round(b / 32) * 32
    const key = `${qr},${qg},${qb}`
    map.set(key, (map.get(key) || 0) + 1)
  }
  const sorted = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors)
  return sorted.map(([k]) => {
    const [r, g, b] = k.split(',').map((x) => Number(x).toString(16).padStart(2, '0'))
    return `#${r}${g}${b}`
  })
}
