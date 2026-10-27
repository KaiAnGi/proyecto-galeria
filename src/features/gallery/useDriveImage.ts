import { useEffect, useRef, useState } from 'react'
import { downloadFileAsBlob } from '../drive/driveImageClient'
import { useAuth } from '../auth/useAuth'

export function useDriveImage(id: string | null | undefined): string | null {
  const { token } = useAuth()
  const [image, setImage] = useState<{ id: string; url: string } | null>(null)
  const objectUrl = useRef<string | null>(null)

  useEffect(() => {
    if (!id || !token) return

    let cancelled = false
    downloadFileAsBlob(token, id)
      .then((blob: Blob) => {
        if (cancelled) return
        const nextUrl = URL.createObjectURL(blob)
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
        objectUrl.current = nextUrl
        setImage({ id, url: nextUrl })
      })
      .catch(() => {
        // Keep any image already loaded for this id.
      })

    return () => {
      cancelled = true
    }
  }, [id, token])

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = null
    },
    [],
  )

  return image && image.id === id ? image.url : null
}
