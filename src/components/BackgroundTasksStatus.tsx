import { es } from '../i18n/es'
import { finishBackgroundTask, useBackgroundTasks, type BackgroundTask } from '../features/gallery/backgroundTasks'

function message(task: BackgroundTask): string {
  if (task.kind === 'originals') {
    return task.status === 'error'
      ? es.pencil.originalsError
      : es.pencil.uploadingOriginals(task.done, task.total)
  }
  if (task.status === 'error') return es.pencil.gifError
  if (task.stage === 'encoding') return es.pencil.gifEncoding
  if (task.stage === 'uploading') return es.pencil.gifUploading
  return es.pencil.gifLoading
}

export default function BackgroundTasksStatus() {
  const tasks = useBackgroundTasks()
  if (tasks.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-3 right-3 z-40 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2"
      style={{ marginTop: 'env(safe-area-inset-top)' }}
    >
      {tasks.map((task) => (
        <div key={task.key} role="status" className="panel px-3 py-2 text-sm shadow-lg">
          <p className="truncate text-xs text-[var(--muted)]">{task.sequenceTitle}</p>
          <div className="flex items-center justify-between gap-2">
            <p>{message(task)}</p>
            {task.status === 'error' && (
              <button
                type="button"
                onClick={() => finishBackgroundTask(task.key)}
                aria-label={es.app.dismiss}
                className="pointer-events-auto min-w-11 min-h-11 rounded-full text-[var(--muted)]"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
