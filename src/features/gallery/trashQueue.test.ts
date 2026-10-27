import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./saveQueue', () => ({
  enqueueSave: vi.fn(),
}))

vi.mock('./persistence', () => ({
  trashObra: vi.fn(async () => undefined),
  trashColeccion: vi.fn(async () => undefined),
  trashSecuencia: vi.fn(async () => undefined),
  trashEntrega: vi.fn(async () => undefined),
}))

import { enqueueSave } from './saveQueue'
import { flushTrash, getTrashSnapshot, queueTrash, undoTrash } from './trashQueue'

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(enqueueSave).mockImplementation(async (operation) => {
    await operation('token')
  })
  undoTrash()
})

describe('trashQueue', () => {
  it('restores the item when the user undoes', () => {
    const restore = vi.fn()

    queueTrash({ key: 'obra:1', restore, commit: vi.fn(async () => undefined) })
    expect(getTrashSnapshot().count).toBe(1)

    undoTrash()

    expect(restore).toHaveBeenCalledTimes(1)
    expect(getTrashSnapshot().count).toBe(0)
  })

  it('moves pending items to the trash when flushed', async () => {
    const commit = vi.fn(async () => undefined)

    queueTrash({ key: 'obra:1', restore: vi.fn(), commit })
    flushTrash()

    await vi.waitFor(() => expect(commit).toHaveBeenCalledWith('token'))
    expect(getTrashSnapshot().count).toBe(0)
  })
})
