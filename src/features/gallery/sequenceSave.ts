import { enqueueSave } from './saveQueue'
import { saveSecuencia } from './persistence'
import { useGalleryStore } from './store'

export function persistLatestSequence(id: string): void {
  const latest = useGalleryStore.getState().secuencias.find((sequence) => sequence.id === id)
  if (!latest) return
  void enqueueSave((token) => saveSecuencia(token, latest)).catch(() => undefined)
}
