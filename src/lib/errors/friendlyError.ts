import { es } from '../../i18n/es'

const NETWORK_RE = /failed to fetch|networkerror|load failed|network connection|cors|blocked|adblock/i
const HTTP_ERROR_RE = /(?:Upload|Drive API|Calendar API|Download|Update|Trash) error: (\d{3})/

export function shouldRefreshSession(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const status = HTTP_ERROR_RE.exec(e.message)?.[1]
  if (status === '401') return true
  return (
    status === '403' &&
    /insufficientPermissions|insufficient authentication scopes|insufficient permission|forbidden/i.test(
      e.message,
    )
  )
}

export function friendlyError(e: unknown, fallback: string = es.errors.unexpected): string {
  if (!(e instanceof Error)) return fallback
  const msg = e.message

  if (NETWORK_RE.test(msg)) return es.errors.network
  if (/video recording/i.test(msg)) return es.pencil.videoUnavailable

  if (/accessnotconfigured|service_disabled|calendar api.*(?:disabled|not been used)/i.test(msg)) {
    return es.errors.calendarUnavailable
  }

  const status = HTTP_ERROR_RE.exec(msg)?.[1]
  if (status === '401') return es.errors.session
  if (status === '403') return es.errors.permission
  if (msg === 'Raíz no encontrada') return es.errors.notFound
  if (/google identity services|gis|oauth|token client|no se pudo cargar|cuenta google|sign in/i.test(msg)) {
    return es.app.connectError
  }

  return fallback
}
