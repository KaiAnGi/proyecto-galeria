import { useEffect, useRef } from 'react'
import { es } from '../../i18n/es'

interface ShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

export default function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={es.pencil.shortcutsTitle}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-md p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{es.pencil.shortcutsTitle}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={es.pencil.closeHelp}
            className="btn btn-soft min-h-11 min-w-11 px-2"
          >
            ×
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="font-mono font-semibold">Espacio</dt>
          <dd>{es.pencil.shortcutPlay}</dd>
          <dt className="font-mono font-semibold">← →</dt>
          <dd>{es.pencil.shortcutStep}</dd>
          <dt className="font-mono font-semibold">O</dt>
          <dd>{es.pencil.shortcutOnion}</dd>
          <dt className="font-mono font-semibold">Ctrl / ⌘ + Z</dt>
          <dd>{es.pencil.shortcutUndo}</dd>
          <dt className="font-mono font-semibold">Ctrl / ⌘ + ⇧ + Z</dt>
          <dd>{es.pencil.shortcutRedo}</dd>
          <dt className="font-mono font-semibold">?</dt>
          <dd>{es.pencil.shortcutHelp}</dd>
        </dl>
      </div>
    </div>
  )
}
