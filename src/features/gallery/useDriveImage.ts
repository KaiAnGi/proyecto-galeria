import { useEffect, useRef, useState } from 'react'
import { downloadFileAsBlob } from '../drive/driveImageClient'
import { getToken } from '../auth/googleAuth'

export function useDriveImage(id: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const lastId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    let objUrl: string | null = null
    const currentId = id ?? null
    if (lastId.current !== currentId) {
      lastId.current = currentId
    }

    const token = getToken()
    if (!id || !token) {
      return
    }
    downloadFileAsBlob(token, id)
      .then((blob: Blob) => {
        if (cancelled || lastId.current !== id) return
        objUrl = URL.createObjectURL(blob)
        setUrl(objUrl)
      })
      .catch(() => {
        if (!cancelled && lastId.current === id) setUrl(null)
      })
    return () => {
      cancelled = true
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [id])

  if (lastId.current !== (id ?? null)) {
    return null
  }
  return url
}
