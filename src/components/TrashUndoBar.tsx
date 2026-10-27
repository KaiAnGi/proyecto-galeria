import { es } from '../i18n/es'
import { undoTrash, useTrashQueue } from '../features/gallery/trashQueue'

export default function TrashUndoBar() {
  const { count } = useTrashQueue()

  if (count === 0) return null

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 panel px-4 py-3 flex items-center gap-4 z-40 pop-in"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <span className="text-sm">{es.gallery.trashPending(count)}</span>
      <button type="button" onClick={() => undoTrash()} className="btn btn-accent">
        {es.gallery.undo}
      </button>
    </div>
  )
}
