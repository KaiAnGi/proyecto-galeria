import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import type { Secuencia } from '../features/gallery/secuencias'
import { queueSecuenciaTrash } from '../features/gallery/trashQueue'
import { useSequenceDrafts } from '../features/gallery/sequenceDrafts'
import { saveSequenceDraft } from '../features/gallery/sequenceSave'
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
  queueSecuenciaTrash: vi.fn(),
}))

vi.mock('../features/gallery/sequenceSave', () => ({
  saveSequenceDraft: vi.fn(),
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
  mainFileId: 'video-1',
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
  useSequenceDrafts.setState({ drafts: {} })
  useGalleryStore.getState().hydrate({ secuencias: [sequence], obras: [], colecciones: [], entregas: [] })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('AnimacionDetail', () => {
  it('shows the title, transport, timeline and save action', async () => {
    renderEditor()

    expect(await screen.findByDisplayValue('Olas')).toBeTruthy()
    expect(screen.getByText('Fotograma 1 de 2')).toBeTruthy()
    expect(screen.getAllByLabelText('Quitar este fotograma')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /guardar animación/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /volver/i }).getAttribute('href')).toBe('/animaciones')
  })

  it('removes a frame locally with an undo action', async () => {
    renderEditor()
    await screen.findByDisplayValue('Olas')

    fireEvent.click(screen.getAllByLabelText('Quitar este fotograma')[0])

    expect(screen.getAllByLabelText('Quitar este fotograma')).toHaveLength(1)
    expect(screen.getByText(/fotograma quitado/i)).toBeTruthy()
    expect(queueSecuenciaTrash).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /deshacer/i }))

    expect(screen.getAllByLabelText('Quitar este fotograma')).toHaveLength(2)
  })

  it('deletes the whole animation and returns to the library', async () => {
    renderEditor()
    await screen.findByDisplayValue('Olas')

    fireEvent.click(screen.getByLabelText('Borrar animación'))

    expect(queueSecuenciaTrash).toHaveBeenCalledWith(sequence)
    expect(screen.getByText('Biblioteca')).toBeTruthy()
  })

  it('keeps edits local until the user saves the animation', async () => {
    vi.mocked(saveSequenceDraft).mockResolvedValue({
      sequence: { ...sequence, rev: 2, titulo: 'Nuevo título' },
      frames: sequence.frames,
    })
    renderEditor()
    await screen.findByDisplayValue('Olas')

    fireEvent.change(screen.getByDisplayValue('Olas'), { target: { value: 'Nuevo título' } })
    fireEvent.click(screen.getByRole('button', { name: /bucle/i }))

    expect(screen.getByText('Cambios sin guardar')).toBeTruthy()
    expect(saveSequenceDraft).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardar animación/i }))
    })

    expect(saveSequenceDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sec-1', titulo: 'Nuevo título', bucle: false }),
      expect.any(Function),
    )
    expect(await screen.findByText('Animación guardada')).toBeTruthy()
  })

  it('toggles onion skin without marking changes', async () => {
    renderEditor()
    await screen.findByDisplayValue('Olas')
    const onion = screen.getByRole('button', { name: /papel cebolla/i })

    fireEvent.click(onion)

    expect(onion.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Animación guardada')).toBeTruthy()
  })
})
