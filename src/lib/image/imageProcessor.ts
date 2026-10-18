export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
    img.src = src
  })
}

export async function resizeToMaxDimensions(
  image: HTMLImageElement,
  maxLongSide: number,
  mimeType: 'image/webp' | 'image/jpeg',
  quality = 0.85,
): Promise<Blob> {
  const { width, height } = image
  if (width === 0 || height === 0) throw new Error('Invalid image')
  const longSide = Math.max(width, height)
  if (longSide <= maxLongSide) {
    // Still return as blob at desired mime if small
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context unavailable')
    ctx.drawImage(image, 0, 0, width, height)
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), mimeType, quality)
    })
  }
  const scale = maxLongSide / longSide
  const targetW = Math.round(width * scale)
  const targetH = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')
  ctx.drawImage(image, 0, 0, targetW, targetH)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), mimeType, quality)
  })
}

export async function createMiniDataUrl(image: HTMLImageElement, maxLongSide = 480, quality = 0.8): Promise<string> {
  const blob = await resizeToMaxDimensions(image, maxLongSide, 'image/webp', quality)
  // Try WebP; if mime is different (Safari), retry as JPEG
  const mime = blob.type || 'image/webp'
  const blobToUse = mime.includes('webp') ? blob : await resizeToMaxDimensions(image, maxLongSide, 'image/jpeg', quality)
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blobToUse)
  })
}
