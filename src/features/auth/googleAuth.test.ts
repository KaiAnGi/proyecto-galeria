import { describe, it, expect, vi, beforeEach } from 'vitest'

type OauthStub = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        callback: (resp: { access_token: string; expires_in: number }) => void
      }) => { requestAccessToken: () => void }
    }
  }
}

describe('googleAuth', () => {
  beforeEach(() => {
    vi.resetModules()
    delete (window as { google?: unknown }).google
    sessionStorage.clear()
    localStorage.clear()
  })

  it('starts with no token', async () => {
    const auth = await import('./googleAuth')
    expect(auth.getToken()).toBeNull()
    expect(auth.hasValidToken()).toBe(false)
  })

  it('throws when Google Identity Services is not available', async () => {
    const auth = await import('./googleAuth')
    await expect(auth.signInWithGoogle()).rejects.toThrow('Google Identity Services no disponible')
  })

  it('stores the access token in memory after sign in', async () => {
    const google: OauthStub = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            requestAccessToken: () => config.callback({ access_token: 'token-abc', expires_in: 3600 }),
          }),
        },
      },
    }
    ;(window as { google?: OauthStub }).google = google

    const auth = await import('./googleAuth')
    const token = await auth.signInWithGoogle()

    expect(token).toBe('token-abc')
    expect(auth.getToken()).toBe('token-abc')
    expect(auth.hasValidToken()).toBe(true)
  })

  it('rejects when Google returns an error', async () => {
    const google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: { callback: (resp: { error: string }) => void }) => ({
            requestAccessToken: () => config.callback({ error: 'access_denied' }),
          }),
        },
      },
    }
    ;(window as { google?: unknown }).google = google

    const auth = await import('./googleAuth')
    await expect(auth.signInWithGoogle()).rejects.toThrow('access_denied')
  })

  it('restores a valid token from the current tab without opening Google', async () => {
    sessionStorage.setItem(
      'gallery-auth-session-v1',
      JSON.stringify({ accessToken: 'restored-token', expiresAt: Math.floor(Date.now() / 1000) + 3600 }),
    )
    const requestAccessToken = vi.fn()
    ;(window as { google?: unknown }).google = {
      accounts: { oauth2: { initTokenClient: () => ({ requestAccessToken }) } },
    }

    const auth = await import('./googleAuth')

    expect(auth.getToken()).toBe('restored-token')
    expect(auth.getAuthSnapshot().hasConnectedBefore).toBe(true)
    expect(requestAccessToken).not.toHaveBeenCalled()
  })

  it('renews silently on demand without asking for an account', async () => {
    localStorage.setItem('gallery-has-connected-v1', '1')
    let prompt: string | undefined = 'unset'
    ;(window as { google?: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            callback: (resp: { access_token: string; expires_in: number }) => void
          }) => ({
            requestAccessToken: (options?: { prompt?: string }) => {
              prompt = options?.prompt
              config.callback({ access_token: 'renewed-token', expires_in: 3600 })
            },
          }),
        },
      },
    }

    const auth = await import('./googleAuth')
    const token = await auth.ensureToken()

    expect(token).toBe('renewed-token')
    expect(prompt).toBe('')
  })

  it('does not expose an expired token to the interface', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    ;(window as { google?: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            callback: (resp: { access_token: string; expires_in: number }) => void
          }) => ({
            requestAccessToken: () => config.callback({ access_token: 'short-token', expires_in: 3600 }),
          }),
        },
      },
    }

    const auth = await import('./googleAuth')
    await auth.signInWithGoogle()
    expect(auth.getAuthSnapshot().token).toBe('short-token')

    vi.setSystemTime(new Date('2026-01-01T02:00:00.000Z'))
    expect(auth.getToken()).toBeNull()
    expect(auth.getAuthSnapshot().token).toBeNull()
    vi.useRealTimers()
  })

  it('persists the token for reloads in the same tab', async () => {
    ;(window as { google?: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            callback: (resp: { access_token: string; expires_in: number }) => void
          }) => ({
            requestAccessToken: () => config.callback({ access_token: 'tab-token', expires_in: 3600 }),
          }),
        },
      },
    }

    const auth = await import('./googleAuth')
    await auth.signInWithGoogle()

    const stored = JSON.parse(sessionStorage.getItem('gallery-auth-session-v1') ?? '{}')
    expect(stored.accessToken).toBe('tab-token')
    expect(localStorage.getItem('gallery-has-connected-v1')).toBe('1')
  })
})
