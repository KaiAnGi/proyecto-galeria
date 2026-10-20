const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

let token: string | null = null
let tokenExpiry: number | null = null
let tokenClient: any = null

declare global {
  interface Window {
    google?: any
  }
}

export async function initGoogleAuth(): Promise<void> {
  if (window.google) return
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'))
    document.head.appendChild(script)
  })
}

export function getToken(): string | null {
  return token
}

export function hasValidToken(): boolean {
  if (!token || !tokenExpiry) return false
  const now = Date.now() / 1000
  return now < tokenExpiry - 60
}

export async function signInWithGoogle(): Promise<string> {
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services no disponible')
  }

  if (tokenClient) {
    try {
      if (hasValidToken()) return token as string
      tokenClient.requestAccessToken({ prompt: 'select_account' })
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout al renovar token')), 30000)
        const orig = tokenClient.callback
        tokenClient.callback = (resp: any) => {
          clearTimeout(timeout)
          tokenClient.callback = orig
          if (resp.error) {
            reject(new Error(resp.error))
            return
          }
          storeToken(resp)
          resolve(token as string)
        }
      })
    } catch {
      // fallback
    }
  }

  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      login_hint: undefined,
      callback: (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error))
          return
        }
        storeToken(resp)
        resolve(token as string)
      },
      error_callback: (err: any) => {
        reject(new Error(err?.type || 'Error de autenticación'))
      },
    })

    tokenClient.requestAccessToken({ prompt: 'select_account' })
  })
}

function storeToken(resp: any) {
  token = resp.access_token
  tokenExpiry = resp.expires_in ? Date.now() / 1000 + resp.expires_in : null
}







