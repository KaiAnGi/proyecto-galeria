import { describe, it, expect } from 'vitest'
import { friendlyError, shouldRefreshSession } from './friendlyError'
import { es } from '../../i18n/es'

describe('friendlyError', () => {
  it('maps browser fetch failures to the network message', () => {
    expect(friendlyError(new TypeError('Failed to fetch'))).toBe(es.errors.network)
    expect(friendlyError(new TypeError('NetworkError when attempting to fetch resource.'))).toBe(
      es.errors.network,
    )
    expect(friendlyError(new Error('Load failed'))).toBe(es.errors.network)
  })

  it('maps expired sessions to the session message', () => {
    expect(friendlyError(new Error('Upload error: 401'))).toBe(es.errors.session)
  })

  it('maps forbidden requests to a permission message', () => {
    expect(friendlyError(new Error('Drive API error: 403'))).toBe(es.errors.permission)
  })

  it('explains when the Calendar API is not enabled', () => {
    expect(
      friendlyError(
        new Error(
          'Calendar API error: 403 {"error":{"reason":"accessNotConfigured","message":"Google Calendar API has not been used in project 123"}}',
        ),
      ),
    ).toBe(es.errors.calendarUnavailable)
  })

  it('detects responses that need a fresh Google session', () => {
    expect(shouldRefreshSession(new Error('Calendar API error: 401'))).toBe(true)
    expect(
      shouldRefreshSession(
        new Error('Calendar API error: 403 {"reason":"insufficientPermissions"}'),
      ),
    ).toBe(true)
    expect(shouldRefreshSession(new Error('Calendar API error: 403'))).toBe(false)
    expect(shouldRefreshSession(new Error('Upload error: 500'))).toBe(false)
    expect(shouldRefreshSession('not an error')).toBe(false)
  })

  it('maps a missing root folder', () => {
    expect(friendlyError(new Error('Raíz no encontrada'))).toBe(es.errors.notFound)
  })

  it('explains when the browser cannot record video', () => {
    expect(friendlyError(new Error('Video recording unavailable'))).toBe(es.pencil.videoUnavailable)
    expect(friendlyError(new Error('Video recording failed'))).toBe(es.pencil.videoUnavailable)
  })

  it('falls back for anything else', () => {
    expect(friendlyError(new Error('Upload error: 500'))).toBe(es.errors.unexpected)
    expect(friendlyError(new Error('boom'))).toBe(es.errors.unexpected)
    expect(friendlyError('not an error')).toBe(es.errors.unexpected)
    expect(friendlyError(undefined, es.gallery.uploadError)).toBe(es.gallery.uploadError)
  })
})
