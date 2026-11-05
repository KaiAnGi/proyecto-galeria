const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'
const SCOPES = `${DRIVE_SCOPE} ${CALENDAR_SCOPE}`
const SESSION_KEY = 'gallery-auth-session-v1'
const CONNECTED_KEY = 'gallery-has-connected-v1'
const EXPIRY_SKEW_SECONDS = 60
const RENEW_BEFORE_SECONDS = 5 * 60
const REQUEST_TIMEOUT_MS = 60_000

type PromptMode = '' | 'select_account' | 'consent'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

interface TokenError {
  type?: string
  message?: string
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: PromptMode }) => void
}

interface OAuth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (resp: TokenResponse) => void
    error_callback?: (err: TokenError) => void
  }) => TokenClient
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: OAuth2
      }
    }
  }
}

export type AuthStatus = 'disconnected' | 'connecting' | 'renewing' | 'connected' | 'error'

export interface AuthSnapshot {
  status: AuthStatus
  token: string | null
  hasConnectedBefore: boolean
  gisReady: boolean
  error: string | null
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

interface StoredSession {
  accessToken: string
  expiresAt: number
  scopes?: string[]
}

interface PendingRequest {
  resolve: (token: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

const listeners = new Set<() => void>()
let token: string | null = null
let expiresAt: number | null = null
let grantedScopes: string[] = []
let tokenClient: TokenClient | null = null
let calendarTokenClient: TokenClient | null = null
let gisPromise: Promise<void> | null = null
let currentRequest: PendingRequest | null = null
let renewPromise: Promise<string> | null = null
let autoRenewInstalled = false
let hasConnectedBefore = readConnectedFlag()
let gisReady = false

let snapshot: AuthSnapshot = {
  status: 'disconnected',
  token: null,
  hasConnectedBefore,
  gisReady,
  error: null,
}

function emit(patch: Partial<AuthSnapshot>): void {
  snapshot = { ...snapshot, ...patch }
  for (const listener of listeners) listener()
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAuthSnapshot(): AuthSnapshot {
  if (snapshot.token && !getToken()) {
    snapshot = { ...snapshot, token: null }
  }
  return snapshot
}

function readConnectedFlag(): boolean {
  try {
    return localStorage.getItem(CONNECTED_KEY) === '1'
  } catch {
    return false
  }
}

function writeConnectedFlag(): void {
  try {
    localStorage.setItem(CONNECTED_KEY, '1')
  } catch {
    // Storage can be unavailable in private browsing.
  }
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') return null
    return {
      accessToken: parsed.accessToken,
      expiresAt: parsed.expiresAt,
      scopes: Array.isArray(parsed.scopes) ? parsed.scopes.filter((scope): scope is string => typeof scope === 'string') : [],
    }
  } catch {
    return null
  }
}

function persistSession(): void {
  if (!token || !expiresAt) return
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: token, expiresAt, scopes: grantedScopes }))
  } catch {
    // The token remains available in memory.
  }
}

function clearStoredSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing to clear.
  }
}

function restoreSession(): void {
  const stored = readStoredSession()
  const now = Date.now() / 1000
  if (stored && stored.expiresAt > now + EXPIRY_SKEW_SECONDS) {
    token = stored.accessToken
    expiresAt = stored.expiresAt
    grantedScopes = stored.scopes ?? []
    hasConnectedBefore = true
    writeConnectedFlag()
    emit({ status: 'connected', token, hasConnectedBefore, error: null })
    return
  }

  token = null
  expiresAt = null
  grantedScopes = []
  clearStoredSession()
  emit({ status: 'disconnected', token: null, hasConnectedBefore, error: null })
}

function parseScopes(scope: string | undefined): string[] {
  if (!scope) return [DRIVE_SCOPE]
  return scope.split(/\s+/).filter(Boolean)
}

function storeToken(resp: TokenResponse): void {
  if (!resp.access_token) throw new AuthError('No se obtuvo token')
  token = resp.access_token
  const lifetime = typeof resp.expires_in === 'number' && resp.expires_in > 0 ? resp.expires_in : 3600
  expiresAt = Math.floor(Date.now() / 1000) + lifetime
  grantedScopes = parseScopes(resp.scope)
  hasConnectedBefore = true
  writeConnectedFlag()
  persistSession()
  emit({ status: 'connected', token, hasConnectedBefore, error: null })
}

export function getToken(): string | null {
  if (!token || !expiresAt) return null
  const now = Date.now() / 1000
  return now < expiresAt - EXPIRY_SKEW_SECONDS ? token : null
}

export function hasValidToken(): boolean {
  return getToken() !== null
}

export function hasCalendarScope(): boolean {
  return hasValidToken() && grantedScopes.includes(CALENDAR_SCOPE)
}

function shouldRenewSoon(): boolean {
  if (!token || !expiresAt) return true
  const now = Date.now() / 1000
  return now >= expiresAt - RENEW_BEFORE_SECONDS
}

function initTokenClient(): TokenClient {
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new AuthError('Google Identity Services no disponible')

  tokenClient = oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback: handleTokenResponse,
    error_callback: handleTokenError,
  })
  calendarTokenClient = oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES,
    callback: handleTokenResponse,
    error_callback: handleTokenError,
  })
  gisReady = true
  emit({ gisReady: true })
  return tokenClient
}

function renewClient(): TokenClient | null {
  if (grantedScopes.includes(CALENDAR_SCOPE) && calendarTokenClient) return calendarTokenClient
  return tokenClient
}

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisPromise) return gisPromise

  gisPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gis]')
    if (existing) {
      // A previous attempt failed (there is no shared load in progress), so retry cleanly.
      existing.remove()
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleGis = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new AuthError('No se pudo cargar Google Identity Services'))
    document.head.appendChild(script)
  }).finally(() => {
    gisPromise = null
  })

  return gisPromise
}

export async function preloadGoogleAuth(): Promise<void> {
  if (tokenClient) return
  await loadGisScript()
  if (!tokenClient) initTokenClient()
}

export async function initGoogleAuth(): Promise<void> {
  return preloadGoogleAuth()
}

function handleTokenResponse(resp: TokenResponse): void {
  const request = currentRequest
  currentRequest = null
  if (request) clearTimeout(request.timeout)

  if (resp.error) {
    const error = new AuthError(resp.error)
    emit({
      status: hasValidToken() ? 'connected' : 'error',
      token: hasValidToken() ? token : null,
      error: resp.error,
    })
    request?.reject(error)
    return
  }

  try {
    storeToken(resp)
    request?.resolve(token as string)
  } catch (e) {
    const error = e instanceof Error ? e : new AuthError('No se obtuvo token')
    emit({ status: 'error', token: null, error: error.message })
    request?.reject(error)
  }
}

function handleTokenError(err: TokenError): void {
  const request = currentRequest
  currentRequest = null
  if (request) clearTimeout(request.timeout)

  const message = err?.type || err?.message || 'Error de autenticación'
  const valid = hasValidToken()
  emit({ status: valid ? 'connected' : 'error', token: valid ? token : null, error: message })
  request?.reject(new AuthError(message))
}

function requestToken(
  prompt: PromptMode,
  mode: 'connect' | 'renew',
  force = false,
  selectedClient?: TokenClient | null,
): Promise<string> {
  if (!force && mode === 'renew' && hasValidToken() && !shouldRenewSoon()) {
    return Promise.resolve(token as string)
  }
  if (renewPromise) return renewPromise
  const client = selectedClient ?? tokenClient
  if (!client) {
    return Promise.reject(new AuthError('Google Identity Services no disponible'))
  }
  emit({ status: mode === 'connect' ? 'connecting' : 'renewing', error: null })

  renewPromise = new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (currentRequest) {
        currentRequest = null
      }
      const valid = hasValidToken()
      emit({ status: valid ? 'connected' : 'error', token: valid ? token : null, error: 'timeout' })
      reject(new AuthError('Timeout al conectar con Google'))
    }, REQUEST_TIMEOUT_MS)

    currentRequest = { resolve, reject, timeout }

    try {
      client.requestAccessToken({ prompt })
    } catch (e) {
      clearTimeout(timeout)
      currentRequest = null
      const error = e instanceof Error ? e : new AuthError('Error de autenticación')
      emit({ status: 'error', token: null, error: error.message })
      reject(error)
    }
  }).finally(() => {
    renewPromise = null
  })

  return renewPromise
}

export async function signInWithGoogle(): Promise<string> {
  if (!tokenClient) {
    if (!window.google?.accounts?.oauth2) {
      throw new AuthError('Google Identity Services no disponible')
    }
    initTokenClient()
  }
  return requestToken('select_account', 'connect')
}

export function renewToken(): Promise<string> {
  return requestToken('', 'renew', false, renewClient())
}

export async function ensureCalendarToken(): Promise<string> {
  const valid = getToken()
  if (valid && hasCalendarScope()) return valid
  if (!hasConnectedBefore) throw new AuthError('Todavía no has conectado tu Drive')
  if (renewPromise) {
    await renewPromise.catch(() => undefined)
    const renewed = getToken()
    if (renewed && hasCalendarScope()) return renewed
  }
  if (!calendarTokenClient) {
    await preloadGoogleAuth()
  }
  return requestToken('consent', 'renew', true, calendarTokenClient)
}

export async function ensureToken(): Promise<string> {
  const valid = getToken()
  if (valid) return valid
  if (renewPromise) return renewPromise
  if (!hasConnectedBefore) throw new AuthError('Todavía no has conectado tu Drive')
  if (!tokenClient) {
    await preloadGoogleAuth()
  }
  return requestToken('', 'renew', false, renewClient())
}

export function disconnectGoogle(): void {
  token = null
  expiresAt = null
  grantedScopes = []
  hasConnectedBefore = false
  clearStoredSession()
  try {
    localStorage.removeItem(CONNECTED_KEY)
  } catch {
    // Nothing to clear.
  }
  emit({ status: 'disconnected', token: null, hasConnectedBefore: false, error: null })
}

export function installAuthAutoRenew(): void {
  if (autoRenewInstalled || typeof document === 'undefined') return
  autoRenewInstalled = true

  const renewOnGesture = () => {
    if (!hasConnectedBefore || renewPromise) return
    if (hasValidToken() && !shouldRenewSoon()) return
    if (!tokenClient) {
      void preloadGoogleAuth().catch(() => undefined)
      return
    }
    void renewToken().catch(() => undefined)
  }

  document.addEventListener('pointerdown', renewOnGesture, true)
  document.addEventListener('keydown', renewOnGesture, true)
}

restoreSession()
