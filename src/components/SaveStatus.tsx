import { es } from '../i18n/es'
import { clearSaveError, retryLastSave, useSaveStatus } from '../features/gallery/saveQueue'

export default function SaveStatus() {
  const { pending, error } = useSaveStatus()

  if (pending === 0 && !error) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 panel px-4 py-2 flex items-center gap-3 text-sm shadow-lg"
      style={{ marginTop: 'env(safe-area-inset-top)' }}
    >
      <span>{pending > 0 ? es.app.saving : error}</span>
      {error && pending === 0 && (
        <>
          <button type="button" onClick={retryLastSave} className="btn btn-soft min-h-11">
            {es.app.retrySave}
          </button>
          <button
            type="button"
            onClick={clearSaveError}
            aria-label={es.app.dismiss}
            className="min-w-11 min-h-11 rounded-full text-[var(--muted)]"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}
