import { useState, useEffect } from 'react'
import { es } from '../i18n/es'
import { ensureToken, preloadGoogleAuth, signInWithGoogle } from '../features/auth/googleAuth'
import { useAuth } from '../features/auth/useAuth'
import { initDriveStructure } from '../features/drive/driveClient'
import { ensureLoaded } from '../features/gallery/persistence'
import { exportAllToZip } from '../lib/export/zipExport'
import { friendlyError } from '../lib/errors/friendlyError'
import { useGalleryStore } from '../features/gallery/store'
import { SparkleSticker, HeartSticker, StarSticker } from '../components/Stickers'

export default function Home() {
  const auth = useAuth()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rootId, setRootId] = useState<string | null>(() => sessionStorage.getItem('gallery-root-id'))
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!auth.token) return
    let cancelled = false
    initDriveStructure(auth.token)
      .then((root) => {
        if (cancelled) return
        setRootId(root)
        sessionStorage.setItem('gallery-root-id', root)
      })
      .catch((e) => {
        if (cancelled) return
        console.error('Drive structure setup failed', e)
      })
    return () => {
      cancelled = true
    }
  }, [auth.token])

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    try {
      await preloadGoogleAuth()
      const token = await signInWithGoogle()
      const root = await initDriveStructure(token)
      setRootId(root)
      sessionStorage.setItem('gallery-root-id', root)
    } catch (e) {
      console.error('Connect failed', e)
      setError(friendlyError(e, es.app.connectError))
    } finally {
      setConnecting(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const token = await ensureToken()
      await ensureLoaded(token)
      const s = useGalleryStore.getState()
      const blob = await exportAllToZip(
        {
          obras: s.obras,
          colecciones: s.colecciones,
          secuencias: s.secuencias,
          entregas: s.entregas,
        },
        token,
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mi-galeria.zip'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      alert(es.app.exportError)
    } finally {
      setExporting(false)
    }
  }

  const busy = connecting || auth.status === 'connecting'
  const showMenu = auth.hasConnectedBefore || rootId !== null
  const showConnect = !showMenu
  const sessionError = !auth.token && auth.error && auth.status === 'error' ? friendlyError(new Error(auth.error), es.errors.session) : null

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-7">
      <div className="flex flex-col items-center text-center gap-2 fade-up">
        <div className="relative">
          <img
            src="./icon.png"
            alt=""
            aria-hidden="true"
            className={`w-24 h-24 sm:w-28 sm:h-28 sticker-shadow object-contain ${busy ? 'hop' : 'sticker-float'}`}
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

      {showConnect && (
        <div className="flex flex-col items-center gap-4 fade-up" style={{ animationDelay: '0.12s' }}>
          <button onClick={handleConnect} disabled={busy} className="btn btn-primary">
            {busy ? es.app.connecting : es.app.connectDrive}
          </button>

          {error && (
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

      {showMenu && (
        <div className="w-full max-w-xl flex flex-col items-center gap-4 fade-up" style={{ animationDelay: '0.12s' }}>
          {rootId && (
            <p className="chip">
              {es.app.rootFolderId}: {rootId}
            </p>
          )}

          {sessionError && !error && (
            <div className="panel w-full p-4 text-center flex flex-col items-center gap-3">
              <p className="text-sm text-[var(--muted)]">{es.app.tapToReconnect}</p>
              <button type="button" onClick={handleConnect} disabled={busy} className="btn btn-soft">
                {es.app.connectDrive}
              </button>
            </div>
          )}

          {error && (
            <div className="panel w-full p-4 text-center">
              <p className="font-medium text-[var(--accent-soft)]">{error}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">{es.app.adblockHelp}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <a href="#/galeria" className="menu-card">
              <span className="menu-icon">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </span>
              <span className="min-w-0 text-left">
                <span className="block font-semibold">{es.app.goGallery}</span>
                <span className="block text-xs text-[var(--muted)]">{es.app.subGallery}</span>
              </span>
            </a>
            <a href="#/colecciones" className="menu-card">
              <span className="menu-icon">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </span>
              <span className="min-w-0 text-left">
                <span className="block font-semibold">{es.app.goCollections}</span>
                <span className="block text-xs text-[var(--muted)]">{es.app.subCollections}</span>
              </span>
            </a>
            <a href="#/entregas" className="menu-card">
              <span className="menu-icon">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </span>
              <span className="min-w-0 text-left">
                <span className="block font-semibold">{es.app.goEntregas}</span>
                <span className="block text-xs text-[var(--muted)]">{es.app.subEntregas}</span>
              </span>
            </a>
            <a href="#/pencil-test" className="menu-card">
              <span className="menu-icon">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </span>
              <span className="min-w-0 text-left">
                <span className="block font-semibold">{es.app.goAnimations}</span>
                <span className="block text-xs text-[var(--muted)]">{es.app.subAnimations}</span>
              </span>
            </a>
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
