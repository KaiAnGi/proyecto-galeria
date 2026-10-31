import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import type { Secuencia } from '../features/gallery/secuencias'
import { queueFrameTrash, queueSecuenciaTrash } from '../features/gallery/trashQueue'
import { persistLatestSequence } from '../features/gallery/sequenceSave'
import { scheduleGifRefresh } from '../features/gallery/gifRefreshScheduler'
import AnimacionDetail from './AnimacionDetail'

vi.mock('../features/gallery/useGalleryData', () => ({
  useGalleryData: () => ({
    state: 'ready',
    error: null,
    retry: vi.fn(),
    hasConnectedBefore: true,
  }),
}))

vi.mock('../features/gallery/trashQueue', () => ({
  queueFrameTrash: vi.fn(),
  queueSecuenciaTrash: vi.fn(),
}))

vi.mock('../features/gallery/sequenceSave', () => ({
  persistLatestSequence: vi.fn(),
}))

vi.mock('../features/gallery/gifRefreshScheduler', () => ({
  scheduleGifRefresh: vi.fn(),
}))

vi.mock('../features/gallery/sequenceCover', () => ({
  refreshSequenceCover: vi.fn(async () => undefined),
}))

const sequence: Secuencia = {
  schema: 1,
  id: 'sec-1',
  rev: 1,
  updatedAt: '2026-01-02T00:00:00.000Z',
  titulo: 'Olas',
  fps: 12,
  bucle: true,
  frames: [
    { id: 'a', orden: 0, drive: { galeriaId: 'gal-a' } },
    { id: 'b', orden: 1, drive: { galeriaId: 'gal-b' } },
  ],
  mainFileId: 'gif-1',
  gifSignature: '12:1:a@0,b@1',
  miniatura: '',
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/animaciones/sec-1']}>
      <Routes>
        <Route path="/animaciones/:id" element={<AnimacionDetail />} />
        <Route path="/animaciones" element={<div>Biblioteca</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useGalleryStore.getState().hydrate({ secuencias: [sequence], obras: [], colecciones: [], entregas: [] })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('AnimacionDetail', () => {
  it('shows the title, transport and timeline', () => {
    renderEditor()

    expect(screen.getByDisplayValue('Olas')).toBeTruthy()
    expect(screen.getByText('Fotograma 1 de 2')).toBeTruthy()
    expect(screen.getAllByLabelText('Quitar este fotograma')).toHaveLength(2)
    expect(screen.getByRole('link', { name: /volver/i }).getAttribute('href')).toBe('/animaciones')
  })

  it('queues the selected frame for the trash', () => {
    renderEditor()

    fireEvent.click(screen.getAllByLabelText('Quitar este fotograma')[0])

    expect(queueFrameTrash).toHaveBeenCalledWith(expect.objectContaining({ id: 'sec-1' }), expect.objectContaining({ id: 'a' }))
  })

  it('deletes the whole animation and returns to the library', () => {
    renderEditor()

    fireEvent.click(screen.getByLabelText('Borrar animación'))

    expect(queueSecuenciaTrash).toHaveBeenCalledWith(sequence)
    expect(screen.getByText('Biblioteca')).toBeTruthy()
  })

  it('saves the title after the debounce and refreshes the gif when loop changes', () => {
    vi.useFakeTimers()
    renderEditor()

    fireEvent.change(screen.getByDisplayValue('Olas'), { target: { value: 'Nuevo título' } })
    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(persistLatestSequence).toHaveBeenCalledWith('sec-1')

    const loop = screen.getByRole('button', { name: /bucle/i })
    fireEvent.click(loop)

    expect(loop.getAttribute('aria-pressed')).toBe('false')
    expect(scheduleGifRefresh).toHaveBeenCalledWith('sec-1')
  })

  it('toggles onion skin without saving', () => {
    renderEditor()
    const onion = screen.getByRole('button', { name: /papel cebolla/i })

    fireEvent.click(onion)

    expect(onion.getAttribute('aria-pressed')).toBe('true')
  })
})
