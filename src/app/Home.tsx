import { useState, useEffect } from 'react'
import { es } from '../i18n/es'
import { initGoogleAuth, getToken, signInWithGoogle, hasValidToken } from '../features/auth/googleAuth'
import { initDriveStructure } from '../features/drive/driveClient'
import { exportAllToZip } from '../lib/export/zipExport'
import { friendlyError } from '../lib/errors/friendlyError'
import { useGalleryStore } from '../features/gallery/store'
import { SparkleSticker, HeartSticker, StarSticker } from '../components/Stickers'

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [rootId, setRootId] = useState<string | null>(() => sessionStorage.getItem('gallery-root-id'))
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      return
    }
    if (hasValidToken()) {
      let cancelled = false
      const t = setTimeout(() => {
        setStatus('connected')
        initDriveStructure(token)
          .then((root) => {
            if (cancelled) return
            setRootId(root)
            sessionStorage.setItem('gallery-root-id', root)
          })
          .catch((e) => {
            if (cancelled) return
            console.error('Restore drive structure failed', e)
          })
      }, 0)
      return () => {
        cancelled = true
        clearTimeout(t)
      }
    }
    // try to refresh
    let cancelled = false
    const t = setTimeout(() => {
      setStatus('loading')
      initGoogleAuth()
        .then(() => signInWithGoogle())
        .then(() => {
          if (cancelled) return
          const t2 = getToken()
          if (!t2 || !hasValidToken()) throw new Error('No se obtuvo token')
          return initDriveStructure(t2)
        })
        .then((root) => {
          if (cancelled) return
          if (typeof root === 'string') {
            setRootId(root)
            sessionStorage.setItem('gallery-root-id', root)
          }
          setStatus('connected')
        })
        .catch((e) => {
          if (cancelled) return
          console.error('Refresh failed', e)
          setStatus('idle')
        })
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [])

  async function handleConnect() {
    setStatus('loading')
    setError(null)
    try {
      await initGoogleAuth()
      await signInWithGoogle()
      const token = getToken()
      if (!hasValidToken() || !token) {
        throw new Error('No se obtuvo token')
      }
      const root = await initDriveStructure(token)
      setRootId(root)
      sessionStorage.setItem('gallery-root-id', root)
      setStatus('connected')
    } catch (e: any) {
      console.error('Connect failed', e)
      setError(friendlyError(e, es.app.connectError))
      setStatus('error')
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const s = useGalleryStore.getState()
      const blob = await exportAllToZip({
        obras: s.obras,
        colecciones: s.colecciones,
        secuencias: s.secuencias,
        entregas: s.entregas,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mi-galeria.zip'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert(es.app.exportError)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-7">
      <div className="flex flex-col items-center text-center gap-2 fade-up">
        <div className="relative">
          <img
            src="./icon.png"
            alt=""
            aria-hidden="true"
            className={`w-24 h-24 sm:w-28 sm:h-28 sticker-shadow object-contain ${status === 'loading' ? 'hop' : 'sticker-float'}`}
          />
          <SparkleSticker className="absolute -top-2 -right-7 w-7 twinkle" />
          <HeartSticker className="absolute -bottom-2 -left-6 w-6 sticker-float-slow" />
          <span className="absolute -top-3 -left-8 twinkle" style={{ animationDelay: '1.2s' }}>
            <StarSticker className="w-5 h-5" />
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold gradient-text">{es.app.title}</h1>
        <p className="text-[var(--muted)] max-w-sm">{es.app.tagline}</p>
      </div>

      {status !== 'connected' && (
        <div className="flex flex-col items-center gap-4 fade-up" style={{ animationDelay: '0.12s' }}>
          <button onClick={handleConnect} disabled={status === 'loading'} className="btn btn-primary">
            {status === 'loading' ? es.app.connecting : es.app.connectDrive}
          </button>

          {status === 'error' && error && (
            <div className="panel max-w-md p-5 text-center">
              <p className="font-medium text-[var(--accent-soft)]">{error}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{es.app.adblockHelp}</p>
              <button onClick={handleConnect} className="btn btn-soft mt-4">
                {es.app.retry}
              </button>
            </div>
          )}
        </div>
      )}

      {status === 'connected' && (
        <div
          className="w-full max-w-xl flex flex-col items-center gap-4 fade-up"
          style={{ animationDelay: '0.12s' }}
        >
          <p className="chip">
            {es.app.rootFolderId}: {rootId}
          </p>

      <div className="panel w-full p-4 flex flex-col items-center gap-3">
        <button onClick={handleExport} disabled={exporting} className="btn btn-soft">
          {exporting ? es.app.exporting : es.app.exportZip}
        </button>
        <span className="text-xs text-[var(--muted)]">{es.app.subExport}</span>
      </div>

          <div className="panel w-full p-4 flex flex-col items-center gap-3">
            <button onClick={handleExport} disabled={exporting} className="btn btn-soft">
              {exporting ? es.app.exporting : es.app.exportZip}
            </button>
            <span className="text-xs text-[var(--muted)]">{es.app.subExport}</span>
          </div>
        </div>
      )}
    </div>
  )
}
