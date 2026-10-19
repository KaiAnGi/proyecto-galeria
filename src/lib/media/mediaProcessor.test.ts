import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyFile, frameStepSeconds, getVideoThumbnail } from './mediaProcessor'

describe('classifyFile', () => {
  it('detects images', () => {
    expect(classifyFile({ type: 'image/jpeg' })).toBe('imagen')
    expect(classifyFile({ type: 'image/webp' })).toBe('imagen')
  })

  it('detects gifs separately from images', () => {
    expect(classifyFile({ type: 'image/gif' })).toBe('gif')
  })

  it('detects videos by mime and falls back to extension', () => {
    expect(classifyFile({ type: 'video/mp4' })).toBe('video')
    expect(classifyFile({ type: '', name: 'clip.MOV' })).toBe('video')
    expect(classifyFile({ type: '', name: 'clip.webm' })).toBe('video')
  })

  it('returns otro for unknown files', () => {
    expect(classifyFile({ type: 'application/pdf', name: 'tarea.pdf' })).toBe('otro')
    expect(classifyFile({ type: '', name: 'sin-extension' })).toBe('otro')
  })
})

describe('frameStepSeconds', () => {
  it('keeps steps inside safe fps bounds', () => {
    expect(frameStepSeconds(30)).toBeCloseTo(1 / 30)
    expect(frameStepSeconds(0)).toBeCloseTo(1 / 30)
    expect(frameStepSeconds(9999)).toBe(1 / 60)
  })
})

describe('getVideoThumbnail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws the first frame into a canvas data URL', async () => {
    const ctx = { drawImage: vi.fn() }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toDataURL: () => 'data:image/jpeg;base64,thumb',
    }
    const video = { muted: false, playsInline: false, preload: '', src: '', load: vi.fn() }
    const fakeVideo = video as unknown as HTMLVideoElement
    let onSeek: (() => void) | null = null
    Object.defineProperty(fakeVideo, 'onseeked', {
      set(fn: () => void) {
        onSeek = fn
        queueMicrotask(() => fn())
      },
      get: () => null,
    })
    Object.defineProperty(fakeVideo, 'onloadeddata', {
      set(fn: () => void) {
        queueMicrotask(() => fn())
      },
      get: () => null,
    })
    Object.defineProperty(fakeVideo, 'videoWidth', { get: () => 640 })
    Object.defineProperty(fakeVideo, 'videoHeight', { get: () => 480 })
    Object.defineProperty(fakeVideo, 'duration', { get: () => 2 })
    let currentTime = 0
    Object.defineProperty(fakeVideo, 'currentTime', {
      get: () => currentTime,
      set(v: number) {
        currentTime = v
      },
    })

    const createEl = (tag: string) => (tag === 'video' ? fakeVideo : canvas)
    vi.stubGlobal('document', { createElement: createEl })
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:video',
      revokeObjectURL: vi.fn(),
    })

    const url = await getVideoThumbnail(new File(['x'], 'clip.mp4', { type: 'video/mp4' }))

    expect(url).toBe('data:image/jpeg;base64,thumb')
    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(480)
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeVideo, 0, 0, 640, 480)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:video')
    expect(onSeek).toBeTruthy()
  })
})
