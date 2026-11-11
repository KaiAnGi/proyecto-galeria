import { describe, expect, it } from 'vitest'
import { quantizePalette } from './palette'

function pixels(...colors: Array<[number, number, number, number]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colors.length * 16)
  colors.forEach((color, index) => data.set(color, index * 16))
  return data
}

describe('quantizePalette', () => {
  it('counts, clamps and orders the most frequent colours', () => {
    const data = pixels([250, 5, 5, 255], [255, 0, 0, 255], [0, 200, 0, 255])
    expect(quantizePalette(data)).toEqual(['#ff0000', '#00c000'])
  })

  it('ignores transparent pixels', () => {
    expect(quantizePalette(pixels([0, 0, 0, 0], [0, 128, 0, 255]))).toEqual(['#008000'])
  })

  it('limits the number of colours', () => {
    const data = pixels([255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255])
    expect(quantizePalette(data, 2)).toEqual(['#ff0000', '#00ff00'])
  })
})
