import { es } from '../../i18n/es'

const NETWORK_RE = /failed to fetch|networkerror|load failed|network connection/i
const HTTP_ERROR_RE = /(?:Upload|Drive API|Download|Update|Trash) error: (\d{3})/

/**
 * Turns raw errors from Drive/fetch into short everyday Spanish messages
 * suitable for the UI. The original error should still be logged by the caller.
 */
export function friendlyError(e: unknown, fallback: string = es.errors.unexpected): string {
  if (!(e instanceof Error)) return fallback
  const msg = e.message

  if (NETWORK_RE.test(msg)) return es.errors.network

  const status = HTTP_ERROR_RE.exec(msg)?.[1]
  if (status === '401' || status === '403') return es.errors.session
  if (msg === 'Raíz no encontrada') return es.errors.notFound

  return fallback
}
