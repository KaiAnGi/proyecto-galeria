import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGalleryStore } from '../features/gallery/store'
import type { Secuencia } from '../features/gallery/secuencias'
import { queueSecuenciaTrash } from '../features/gallery/trashQueue'
import Animaciones from './Animaciones'

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
  miniatura: 'data:image/webp;base64,AAAA',
}

beforeEach(() => {
  useGalleryStore.getState().hydrate({ secuencias: [sequence], obras: [], colecciones: [], entregas: [] })
})

afterEach(() => {
  cleanup()
})

describe('Animaciones', () => {
  it('shows each animation with its frames and duration', () => {
    render(
      <MemoryRouter>
        <Animaciones />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Animaciones' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Olas' })).toBeTruthy()
    expect(screen.getByText(/2 fotogramas/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /olas/i }).getAttribute('href')).toBe('/animaciones/sec-1')
  })

  it('queues an animation for the trash', () => {
    render(
      <MemoryRouter>
        <Animaciones />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByLabelText('Borrar animación: Olas'))

    expect(queueSecuenciaTrash).toHaveBeenCalledWith(sequence)
  })

  it('opens the guided creation panel', () => {
    render(
      <MemoryRouter>
        <Animaciones />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /nueva animación/i }))

    expect(screen.getByRole('heading', { name: /nueva animación/i })).toBeTruthy()
    expect(screen.getByText(/arrastrar fotos/i)).toBeTruthy()
  })
})
