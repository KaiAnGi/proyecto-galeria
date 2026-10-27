import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ensureLoaded, isGalleryLoaded, resetLoadedOnce } from './persistence'
import { friendlyError } from '../../lib/errors/friendlyError'
import { es } from '../../i18n/es'

export type GalleryDataState = 'idle' | 'loading' | 'ready' | 'error'

interface LoadResult {
  token: string
  state: 'ready' | 'error'
}

export function useGalleryData() {
  const { token, hasConnectedBefore } = useAuth()
  const [result, setResult] = useState<LoadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const loaded = isGalleryLoaded()
  const state: GalleryDataState =
    result?.token === token ? result.state : loaded ? 'ready' : !token ? 'idle' : 'loading'

  useEffect(() => {
    if (loaded || !token) return

    let cancelled = false
    ensureLoaded(token)
      .then(() => {
        if (!cancelled) setResult({ token, state: 'ready' })
      })
      .catch((e) => {
        if (cancelled) return
        setError(friendlyError(e, es.gallery.loadError))
        setResult({ token, state: 'error' })
      })

    return () => {
      cancelled = true
    }
  }, [token, attempt, loaded])

  function retry() {
    resetLoadedOnce()
    setResult(null)
    setError(null)
    setAttempt((value) => value + 1)
  }

  return { state, error, retry, hasConnectedBefore }
}
