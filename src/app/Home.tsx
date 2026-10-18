import { useState } from 'react'
import { Link } from 'react-router-dom'
import { es } from '../i18n/es'
import { initGoogleAuth, getToken, signInWithGoogle, hasValidToken } from '../features/auth/googleAuth'
import { initDriveStructure, saveTestFile, loadTestFile } from '../features/drive/driveClient'
import { exportAllToZip } from '../lib/export/zipExport'
import { useGalleryStore } from '../features/gallery/store'

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [rootId, setRootId] = useState<string | null>(null)
  const [testData, setTestData] = useState<any>(null)
  const [exporting, setExporting] = useState(false)

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
      setStatus('connected')
    } catch (e: any) {
      setError(e?.message || 'Error al conectar')
      setStatus('error')
    }
  }

  async function handleSaveTest() {
    try {
      const token = getToken()
      if (!token) throw new Error('No hay token')
      const saved = await saveTestFile(token)
      setTestData(saved)
      alert(es.app.testSaved)
    } catch (e: any) {
      alert('Error: ' + (e?.message || ''))
    }
  }

  async function handleLoadTest() {
    try {
      const token = getToken()
      if (!token) throw new Error('No hay token')
      const loaded = await loadTestFile(token)
      setTestData(loaded)
      alert(es.app.testLoaded)
    } catch (e: any) {
      alert('Error: ' + (e?.message || ''))
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const s = useGalleryStore.getState()
      const blob = await exportAllToZip({ obras: s.obras, colecciones: s.colecciones, secuencias: s.secuencias })
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
    <div className="min-h-full flex flex-col items-center justify-center p-6 gap-6">
      <h1 className="text-3xl font-bold">{es.app.title}</h1>
      <button
        onClick={handleConnect}
        disabled={status === 'loading'}
        className="min-h-[44px] px-6 py-3 rounded-lg bg-[var(--primary)] text-[var(--text)] disabled:opacity-60"
      >
        {status === 'loading' ? es.app.connecting : es.app.connectDrive}
      </button>

      {status === 'error' && error && (
        <div className="max-w-md text-center text-red-300">
          <p>{error}</p>
          <p className="mt-2 text-sm">{es.app.adblockHelp}</p>
          <button onClick={handleConnect} className="mt-4 min-h-[44px] px-4 py-2 rounded-lg bg-[var(--surface)]">
            {es.app.retry}
          </button>
        </div>
      )}

      {status === 'connected' && (
        <div className="flex flex-col items-center gap-4">
          <p>
            {es.app.rootFolderId}: {rootId}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/galeria" className="min-h-[44px] px-5 py-3 rounded-lg bg-[var(--primary)] text-[var(--text)]">
              {es.app.goGallery}
            </Link>
            <Link to="/colecciones" className="min-h-[44px] px-5 py-3 rounded-lg bg-[var(--surface)]">
              {es.app.goCollections}
            </Link>
            <Link to="/pencil-test" className="min-h-[44px] px-5 py-3 rounded-lg bg-[var(--surface)]">
              {es.app.goPencilTest}
            </Link>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="min-h-[44px] px-5 py-3 rounded-lg bg-[var(--surface)] disabled:opacity-60"
            >
              {exporting ? es.app.exporting : es.app.exportZip}
            </button>
          </div>
          <div className="flex gap-4">
            <button onClick={handleSaveTest} className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--surface)]">
              {es.app.testWrite}
            </button>
            <button onClick={handleLoadTest} className="min-h-[44px] px-4 py-2 rounded-lg bg-[var(--surface)]">
              {es.app.testRead}
            </button>
          </div>
          {testData && (
            <pre className="max-w-xl overflow-auto bg-[var(--surface)] p-4 rounded text-sm">{JSON.stringify(testData, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  )
}
