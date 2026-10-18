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
})
