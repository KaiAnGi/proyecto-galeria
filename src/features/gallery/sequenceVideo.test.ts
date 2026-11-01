import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickVideoMime, videoExtension } from './sequenceVideo'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sequenceVideo', () => {
  it('picks the first supported recording format', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (type: string) => type.startsWith('video/webm'),
    })

    expect(pickVideoMime()).toBe('video/webm;codecs=vp9')
  })

  it('returns an empty string when no format is supported and null without MediaRecorder', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false })
    expect(pickVideoMime()).toBe('')

    vi.unstubAllGlobals()
    expect(pickVideoMime()).toBeNull()
  })

  it('maps recording formats to file extensions', () => {
    expect(videoExtension('video/mp4;codecs=avc1.42E01E')).toBe('mp4')
    expect(videoExtension('video/webm;codecs=vp9')).toBe('webm')
  })
})
