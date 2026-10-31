type ImageMime = 'image/webp' | 'image/jpeg'

export async function readFileAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function fileToBitmap(file: File): Promise<ImageBitmap> {
  const isHeic =
    file.type.includes('heic') || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')

  if (isHeic) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      const { default: heic2any } = await import('heic2any')
      const converted = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob
      return createImageBitmap(converted, { imageOrientation: 'from-image' })
    }
  }

  return createImageBitmap(file, { imageOrientation: 'from-image' })
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

export function determineMime(blobType: string | undefined): 'image/webp' | 'image/jpeg' {
  if (blobType && blobType.includes('webp')) return 'image/webp'
  return 'image/jpeg'
}

export function imageExtension(blob: Blob): 'jpg' | 'png' | 'webp' {
  if (blob.type.includes('jpeg') || blob.type.includes('jpg')) return 'jpg'
  if (blob.type.includes('png')) return 'png'
  return 'webp'
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: ImageMime,
  quality: number,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))),
      mimeType,
      quality,
    )
  })
}

let preferredImageMime: ImageMime | null = null

async function getPreferredImageMime(): Promise<ImageMime> {
  if (preferredImageMime) return preferredImageMime
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  try {
    const blob = await canvasToBlob(canvas, 'image/webp', 0.8)
    preferredImageMime = blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
  } catch {
    preferredImageMime = 'image/jpeg'
  }
  return preferredImageMime
}

export interface ProcessedGalleryImage {
  galleryBlob: Blob
  width: number
  height: number
}

export interface ProcessedImage extends ProcessedGalleryImage {
  miniBlob: Blob
  miniDataUrl: string
}

export function processImage(
  image: HTMLImageElement | ImageBitmap,
  maxLongSide?: number,
  quality?: number,
): Promise<ProcessedImage>
export function processImage(
  image: HTMLImageElement | ImageBitmap,
  maxLongSide: number,
  quality: number,
  includeMini: false,
): Promise<ProcessedGalleryImage>
export async function processImage(
  image: HTMLImageElement | ImageBitmap,
  maxLongSide = 2048,
  quality = 0.8,
  includeMini = true,
): Promise<ProcessedImage | ProcessedGalleryImage> {
  const width = image.width
  const height = image.height
  if (width === 0 || height === 0) throw new Error('Invalid image')

  const longSide = Math.max(width, height)
  const scale = longSide <= maxLongSide ? 1 : maxLongSide / longSide
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  const galleryCanvas = document.createElement('canvas')
  galleryCanvas.width = targetW
  galleryCanvas.height = targetH
  const galleryCtx = galleryCanvas.getContext('2d')
  if (!galleryCtx) throw new Error('Canvas context unavailable')
  galleryCtx.drawImage(image, 0, 0, targetW, targetH)

  const mimeType = await getPreferredImageMime()

  if (!includeMini) {
    const galleryBlob = await canvasToBlob(galleryCanvas, mimeType, quality)
    return { galleryBlob, width, height }
  }

  const miniScale = Math.min(1, 480 / Math.max(targetW, targetH))
  const miniW = Math.max(1, Math.round(targetW * miniScale))
  const miniH = Math.max(1, Math.round(targetH * miniScale))
  const miniCanvas = document.createElement('canvas')
  miniCanvas.width = miniW
  miniCanvas.height = miniH
  const miniCtx = miniCanvas.getContext('2d')
  if (!miniCtx) throw new Error('Canvas context unavailable')
  miniCtx.drawImage(galleryCanvas, 0, 0, miniW, miniH)

  const [galleryBlob, miniBlob] = await Promise.all([
    canvasToBlob(galleryCanvas, mimeType, quality),
    canvasToBlob(miniCanvas, mimeType, quality),
  ])
  const miniDataUrl = await readFileAsDataUrl(miniBlob)

  return { galleryBlob, miniBlob, miniDataUrl, width, height }
}

export async function blobToThumbnailDataUrl(blob: Blob, maxLongSide = 320, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    const longSide = Math.max(bitmap.width, bitmap.height)
    const scale = longSide <= maxLongSide ? 1 : maxLongSide / longSide
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context unavailable')
    context.drawImage(bitmap, 0, 0, width, height)
    const mimeType = await getPreferredImageMime()
    const thumbnail = await canvasToBlob(canvas, mimeType, quality)
    return readFileAsDataUrl(thumbnail)
  } finally {
    bitmap.close()
  }
}

export async function resizeToMaxDimensions(
  image: HTMLImageElement | ImageBitmap,
  maxLongSide: number,
  mimeType: 'image/webp' | 'image/jpeg',
  quality = 0.85,
): Promise<Blob> {
  const width = image.width
  const height = image.height
  if (width === 0 || height === 0) throw new Error('Invalid image')
  const longSide = Math.max(width, height)
  const scale = longSide <= maxLongSide ? 1 : maxLongSide / longSide
  const targetW = Math.round(width * scale)
  const targetH = Math.round(height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')
  ctx.drawImage(image, 0, 0, targetW, targetH)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        // Some engines (older Safari/WebKit) cannot encode webp
        if (mimeType === 'image/jpeg') {
          reject(new Error('toBlob failed'))
          return
        }
        canvas.toBlob((jpeg) => (jpeg ? resolve(jpeg) : reject(new Error('toBlob failed'))), 'image/jpeg', quality)
      },
      mimeType,
      quality,
    )
  })
}

export async function createMiniDataUrl(image: HTMLImageElement | ImageBitmap, maxLongSide = 480, quality = 0.8): Promise<string> {
  const webp = await resizeToMaxDimensions(image, maxLongSide, 'image/webp', quality)
  const mime = webp.type
  const blobToUse = mime.includes('webp') ? webp : await resizeToMaxDimensions(image, maxLongSide, 'image/jpeg', quality)
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blobToUse)
  })
}
