import { test, expect, type Page } from '@playwright/test'
import { stubGis, stubDriveMemory } from './helpers'

const GIF_1PX = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
const FAKE_MP4 = Buffer.from('00000018ftypisom00000200isomiso2avc1mp41fakevideo-bytes', 'utf8')

async function connect(page: Page): Promise<void> {
  await stubGis(page)
  await stubDriveMemory(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Conectar mi Drive' }).click()
  await expect(page.getByText('Carpeta raíz:')).toBeVisible()
}

test('sube un GIF y abre la obra en la galería', async ({ page }) => {
  await connect(page)

  await page.goto('/#/galeria')
  await page.getByRole('button', { name: 'Añadir dibujo' }).click()
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'dibujo.gif',
    mimeType: 'image/gif',
    buffer: GIF_1PX,
  })

  await expect(page.getByRole('heading', { name: 'Sin título' })).toBeVisible()
  await page.getByRole('heading', { name: 'Sin título' }).click()

  await expect(page.getByAltText('Sin título')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Borrar' })).toBeVisible()
})

test('sube un vídeo y el detalle muestra el reproductor', async ({ page }) => {
  await connect(page)

  await page.goto('/#/galeria')
  await page.getByRole('button', { name: 'Añadir dibujo' }).click()
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'clase.mp4',
    mimeType: 'video/mp4',
    buffer: FAKE_MP4,
  })

  await expect(page.getByRole('heading', { name: 'Sin título' })).toBeVisible()
  await page.getByRole('heading', { name: 'Sin título' }).click()

  await expect(page.getByRole('button', { name: 'Reproducir' })).toBeVisible()
  await expect(page.getByText('Velocidad')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Fotograma anterior' })).toBeVisible()
  await expect(page.locator('video')).toBeVisible()
})

test('crea una entrega de clase y vuelve a cargarla desde Drive', async ({ page }) => {
  await connect(page)

  await page.goto('/#/entregas')
  await page.getByPlaceholder('Título de la entrega').fill('Retrato a lápiz')
  await page.getByPlaceholder('Asignatura').fill('Dibujo')
  await page.locator('input[type="date"]').fill('2026-12-31')
  await page.getByRole('button', { name: 'Añadir entrega' }).click()

  await expect(page.getByRole('heading', { name: 'Retrato a lápiz' })).toBeVisible()
  await expect(page.getByText('Dibujo · 2026-12-31')).toBeVisible()
  await expect(page.getByLabel('Estado')).toHaveValue('pendiente')

  await page.reload()
  await page.goto('/')
  await page.getByRole('button', { name: 'Conectar mi Drive' }).click()
  await expect(page.getByText('Carpeta raíz:')).toBeVisible()

  await page.goto('/#/entregas')
  await expect(page.getByRole('heading', { name: 'Retrato a lápiz' })).toBeVisible()
  await expect(page.getByText('Dibujo · 2026-12-31')).toBeVisible()
})

test('el motor indica si puede reproducir MP4 con H.264', async ({ page }) => {
  await page.goto('/')

  const support = await page.evaluate(() => {
    const video = document.createElement('video')
    return video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
  })

  if (!support) {
    test.skip(true, 'Este motor de Playwright no incluye códec H.264; comprobarlo en un iPad real')
  }

  expect(['maybe', 'probably']).toContain(support)
})
