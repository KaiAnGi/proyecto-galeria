import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../auth/googleAuth', () => ({
  ensureToken: vi.fn(async () => 'token'),
}))

import { ensureToken } from '../auth/googleAuth'
import { es } from '../../i18n/es'
import {
  clearSaveError,
  enqueueSave,
  getSaveStatusSnapshot,
  retryLastSave,
} from './saveQueue'

beforeEach(() => {
  vi.clearAllMocks()
  clearSaveError()
})

describe('enqueueSave', () => {
  it('runs operations one after another', async () => {
    const order: string[] = []
    let release: () => void = () => undefined

    const first = enqueueSave(async () => {
      order.push('first-start')
      await new Promise<void>((resolve) => {
        release = resolve
      })
      order.push('first-end')
    })
    const second = enqueueSave(async () => {
      order.push('second')
    })

    try {
      await vi.waitFor(() => expect(order).toEqual(['first-start']))
    } finally {
      release()
    }
    await Promise.all([first, second])

    expect(order).toEqual(['first-start', 'first-end', 'second'])
    expect(ensureToken).toHaveBeenCalled()
    expect(getSaveStatusSnapshot().pending).toBe(0)
  })

  it('shows an error and retries the failed operation', async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error('save failed')).mockResolvedValueOnce(undefined)

    await expect(enqueueSave(operation)).rejects.toThrow('save failed')
    expect(getSaveStatusSnapshot().error).toBe(es.app.saveError)

    retryLastSave()
    await vi.waitFor(() => expect(operation).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(getSaveStatusSnapshot().pending).toBe(0))
    expect(getSaveStatusSnapshot().error).toBeNull()
  })
})
