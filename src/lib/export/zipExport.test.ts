import { describe, it, expect, vi, beforeEach } from 'vitest'
import JSZip from 'jszip'

vi.mock('../../features/drive/driveImageClient', () => ({
  downloadFileAsBlob: vi.fn(),
}))

import { downloadFileAsBlob } from '../../features/drive/driveImageClient'
import type { Obra } from '../../features/gallery/store'
import { exportAllToZip } from './zipExport'

const obra: Obra = {
  schema: 1,
  id: 'obra1',
  rev: 1,
  creadaEn: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Dibujo 1',
  fecha: '2026-01-01',
  estado: 'terminada',
  origen: 'tradicional',
  tecnicas: ['lapiz'],
  tags: [],
  coleccionIds: [],
  miniatura: '',
  archivos: [
    {
      id: 'archivo1',
      tipo: 'imagen',
      rol: 'tradicional',
      orden: 0,
      mime: 'image/webp',
      drive: { originalId: 'orig-1', galeriaId: 'gal-1', miniaturaId: 'mini-1' },
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(downloadFileAsBlob).mockImplementation(async (_token, id) => {
    const mime = id.startsWith('orig') ? 'image/jpeg' : 'image/webp'
    return new Blob([id], { type: mime })
  })
})

describe('exportAllToZip', () => {
  it('includes data, originals and derived images with the right extension', async () => {
    const blob = await exportAllToZip(
      { obras: [obra], colecciones: [], secuencias: [], entregas: [] },
      'token',
    )
    const zip = await JSZip.loadAsync(blob)
    const names = Object.keys(zip.files)

    expect(names).toEqual(
      expect.arrayContaining([
        'obras.json',
        'colecciones.json',
        'secuencias.json',
        'entregas.json',
        'obras/Dibujo 1-obra1/obra.json',
        'obras/Dibujo 1-obra1/original-archivo1.jpg',
        'obras/Dibujo 1-obra1/galeria-archivo1.webp',
        'obras/Dibujo 1-obra1/miniatura-archivo1.webp',
      ]),
    )
    expect(await zip.file('obras/Dibujo 1-obra1/original-archivo1.jpg')?.async('string')).toBe('orig-1')
  })

  it('lists images that could not be downloaded but keeps the ZIP', async () => {
    vi.mocked(downloadFileAsBlob).mockRejectedValue(new Error('Download error: 404'))

    const blob = await exportAllToZip(
      { obras: [obra], colecciones: [], secuencias: [], entregas: [] },
      'token',
    )
    const zip = await JSZip.loadAsync(blob)

    expect(await zip.file('archivos-no-incluidos.txt')?.async('string')).toContain('orig-1')
  })

  it('stops when the session has expired', async () => {
    vi.mocked(downloadFileAsBlob).mockRejectedValue(new Error('Download error: 401'))

    await expect(
      exportAllToZip({ obras: [obra], colecciones: [], secuencias: [], entregas: [] }, 'token'),
    ).rejects.toThrow('401')
  })
})
