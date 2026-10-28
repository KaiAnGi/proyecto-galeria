import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Coleccion, Obra } from '../features/gallery/store'
import type { Secuencia } from '../features/gallery/secuencias'
import { useGalleryStore } from '../features/gallery/store'
import { queueColeccionTrash } from '../features/gallery/trashQueue'
import ColeccionDetail from './ColeccionDetail'

vi.mock('../features/gallery/useGalleryData', () => ({
  useGalleryData: () => ({
    state: 'ready',
    error: null,
    retry: vi.fn(),
    hasConnectedBefore: true,
  }),
}))

vi.mock('../features/gallery/persistence', () => ({
  saveObra: vi.fn(),
  saveSecuencia: vi.fn(),
  syncColeccionObra: vi.fn(),
  syncColeccionSecuencia: vi.fn(),
}))

vi.mock('../features/gallery/saveQueue', () => ({
  enqueueSave: vi.fn(),
}))

vi.mock('../features/gallery/trashQueue', () => ({
  queueColeccionTrash: vi.fn(),
}))

const coleccion: Coleccion = {
  schema: 1,
  id: 'col-1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  nombre: 'Verano',
  tipo: 'general',
  orden: 0,
}

const obra: Obra = {
  schema: 1,
  id: 'obra-1',
  rev: 1,
  creadaEn: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Playa',
  fecha: '2026-01-01',
  estado: 'terminada',
  origen: 'tradicional',
  tecnicas: [],
  tags: [],
  coleccionIds: ['col-1'],
  miniatura: '',
  archivos: [],
}

const secuencia: Secuencia = {
  schema: 1,
  id: 'sec-1',
  rev: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  titulo: 'Olas',
  fps: 12,
  bucle: true,
  frames: [],
  miniatura: '',
  coleccionIds: ['col-1'],
}

beforeEach(() => {
  useGalleryStore.getState().hydrate({
    obras: [obra],
    colecciones: [coleccion],
    secuencias: [secuencia],
    entregas: [],
  })
})

afterEach(() => {
  cleanup()
})

describe('ColeccionDetail', () => {
  it('shows the collection with its works and animations', () => {
    render(
      <MemoryRouter initialEntries={['/coleccion/col-1']}>
        <Routes>
          <Route path="/coleccion/:id" element={<ColeccionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Verano' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Obras' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Animaciones' })).toBeTruthy()
    expect(screen.getByText('Playa')).toBeTruthy()
    expect(screen.getByText('Olas')).toBeTruthy()
  })

  it('offers a way back to the collections list', () => {
    render(
      <MemoryRouter initialEntries={['/coleccion/col-1']}>
        <Routes>
          <Route path="/coleccion/:id" element={<ColeccionDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    const backLink = screen.getByRole('link', { name: /volver/i })
    expect(backLink.getAttribute('href')).toBe('/colecciones')
  })

  it('queues the collection for the trash and returns to the list', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <MemoryRouter initialEntries={['/coleccion/col-1']}>
        <Routes>
          <Route path="/coleccion/:id" element={<ColeccionDetail />} />
          <Route path="/colecciones" element={<p>Lista de colecciones</p>} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Borrar colección' }))

    expect(confirm).toHaveBeenCalled()
    expect(queueColeccionTrash).toHaveBeenCalledWith(coleccion)
    expect(screen.getByText('Lista de colecciones')).toBeTruthy()
    confirm.mockRestore()
  })
})
