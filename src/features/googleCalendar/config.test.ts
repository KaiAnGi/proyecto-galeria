import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../drive/driveImageClient', () => ({
  downloadJson: vi.fn(),
  findFileByName: vi.fn(),
  upsertJson: vi.fn(),
}))

vi.mock('../gallery/upload', () => ({
  getFolderIds: vi.fn(),
}))

import { downloadJson, findFileByName, upsertJson } from '../drive/driveImageClient'
import { getFolderIds } from '../gallery/upload'
import { loadCalendarConfig, saveCalendarConfig } from './config'

describe('calendar config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getFolderIds).mockResolvedValue({
      rootId: 'root-1',
      archivosId: 'archivos-1',
      originalesId: 'originales-1',
      galeriaId: 'galeria-1',
      miniaturasId: 'miniaturas-1',
      datosId: 'datos-1',
      obrasId: 'obras-1',
      coleccionesId: 'colecciones-1',
      secuenciasId: 'secuencias-1',
      entregasId: 'entregas-1',
      calendarioId: 'calendario-1',
      inboxId: 'inbox-1',
    })
    vi.mocked(findFileByName).mockResolvedValue({ id: 'config-1', name: 'config.json' })
    vi.mocked(upsertJson).mockResolvedValue({ id: 'config-1', name: 'config.json' })
  })

  it('keeps unrelated fields when loading the config', async () => {
    vi.mocked(downloadJson).mockResolvedValue({
      schema: 1,
      rev: 3,
      updatedAt: '2026-01-01T00:00:00.000Z',
      calendarId: 'cal-1',
      message: 'Hola',
    })

    await expect(loadCalendarConfig('token')).resolves.toMatchObject({
      rev: 3,
      calendarId: 'cal-1',
      message: 'Hola',
    })
  })

  it('increments rev and preserves existing fields when saving', async () => {
    vi.mocked(downloadJson).mockResolvedValue({
      schema: 1,
      rev: 3,
      updatedAt: '2026-01-01T00:00:00.000Z',
      message: 'Hola',
    })

    const saved = await saveCalendarConfig('token', { calendarId: 'cal-1' })

    expect(saved).toMatchObject({
      rev: 4,
      calendarId: 'cal-1',
      message: 'Hola',
    })
    expect(upsertJson).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ rev: 4, calendarId: 'cal-1', message: 'Hola' }),
      'config.json',
      ['datos-1'],
      { kind: 'config' },
    )
  })
})
