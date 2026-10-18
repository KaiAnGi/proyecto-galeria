import { describe, it, expect } from 'vitest'
import { determineMime } from './imageProcessor'

describe('determineMime', () => {
  it('returns webp when blob type is webp', () => {
    expect(determineMime('image/webp')).toBe('image/webp')
  })

  it('returns jpeg for undefined type', () => {
    expect(determineMime(undefined)).toBe('image/jpeg')
  })

  it('returns jpeg for jpeg-like types', () => {
    expect(determineMime('image/jpeg')).toBe('image/jpeg')
    expect(determineMime('image/jpg')).toBe('image/jpeg')
  })

  it('returns jpeg for png (fallback when webp unsupported)', () => {
    expect(determineMime('image/png')).toBe('image/jpeg')
  })
})
