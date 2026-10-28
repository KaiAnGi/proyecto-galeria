import { describe, expect, it } from 'vitest'
import { mapWithConcurrency } from './mapWithConcurrency'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('mapWithConcurrency', () => {
  it('keeps the result order and limits active work', async () => {
    let active = 0
    let maxActive = 0
    const items = [1, 2, 3, 4, 5]

    const results = await mapWithConcurrency(items, 2, async (item) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await delay(5)
      active -= 1
      return item * 2
    })

    expect(results).toEqual([2, 4, 6, 8, 10])
    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it('returns an empty array for no items', async () => {
    const mapper = async (value: number) => value
    await expect(mapWithConcurrency([], 2, mapper)).resolves.toEqual([])
  })
})
