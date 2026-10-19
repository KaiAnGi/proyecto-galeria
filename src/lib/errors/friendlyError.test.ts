import { describe, it, expect } from 'vitest'
import { friendlyError } from './friendlyError'
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
    expect(friendlyError(new Error('Drive API error: 403'))).toBe(es.errors.session)
  })

  it('maps a missing root folder', () => {
    expect(friendlyError(new Error('Raíz no encontrada'))).toBe(es.errors.notFound)
  })

  it('falls back for anything else', () => {
    expect(friendlyError(new Error('Upload error: 500'))).toBe(es.errors.unexpected)
    expect(friendlyError(new Error('boom'))).toBe(es.errors.unexpected)
    expect(friendlyError('not an error')).toBe(es.errors.unexpected)
    expect(friendlyError(undefined, es.gallery.uploadError)).toBe(es.gallery.uploadError)
  })
})
