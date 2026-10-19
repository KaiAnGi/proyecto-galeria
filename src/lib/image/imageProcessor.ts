import exifr from 'exifr'
import heic2any from 'heic2any'

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function orientationNeedsFlip(orientation: number) {
  return orientation >= 5 && orientation <= 8
}

export async function fileToBitmap(file: File): Promise<ImageBitmap> {
  let blob: Blob = file
  if (file.type.includes('heic') || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
    blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 })) as Blob
  }

  const orientation = await getOrientation(file).catch(() => undefined)

  if (!orientation || orientation === 1) {
    return await createImageBitmap(blob)
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const el = new Image()
    el.onload = () => {
      URL.revokeObjectURL(url)
      resolve(el)
    }
    el.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    el.src = url
  })

  const flip = orientationNeedsFlip(orientation)
  const w = flip ? img.height : img.width
  const h = flip ? img.width : img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')

  // Apply EXIF orientation transforms (common cases)
  switch (orientation) {
    case 2:
      ctx.translate(w, 0); ctx.scale(-1, 1); break
    case 3:
      ctx.translate(w, h); ctx.rotate(Math.PI); break
    case 4:
      ctx.translate(0, h); ctx.scale(1, -1); break
    case 5:
      ctx.rotate(0.5 * Math.PI); ctx.scale(1, -1); break
    case 6:
      ctx.rotate(0.5 * Math.PI); ctx.translate(0, -h); break
    case 7:
      ctx.rotate(0.5 * Math.PI); ctx.translate(w, -h); ctx.scale(-1, 1); break
    case 8:
      ctx.rotate(-0.5 * Math.PI); ctx.translate(-w, 0); break
    default:
      break
  }

  if (flip) {
    ctx.drawImage(img, 0, 0, img.width, img.height)
  } else {
    ctx.drawImage(img, 0, 0, img.width, img.height)
  }

  return await createImageBitmap(canvas)
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

export async function getOrientation(file: File): Promise<number | undefined> {
  try {
    const exif = await exifr.parse(file, ['Orientation'])
    const o = exif?.Orientation
    if (typeof o === 'number') return o
  } catch {
    // ignore
  }
  return undefined
}
