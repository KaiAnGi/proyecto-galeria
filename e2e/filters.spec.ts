import { test, expect, type Page } from '@playwright/test'
import { stubGis, stubDriveMemory } from './helpers'

const GIF_1PX = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

async function connect(page: Page): Promise<void> {
  await stubGis(page)
  await stubDriveMemory(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Conectar mi Drive' }).click()
  await expect(page.getByText('Carpeta raíz:')).toBeVisible()
}

async function uploadOneDrawing(page: Page): Promise<void> {
  await page.goto('/#/galeria')
  await page.getByRole('button', { name: 'Añadir dibujo' }).click()
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'dibujo.gif',
    mimeType: 'image/gif',
    buffer: GIF_1PX,
  })
  await expect(page.getByRole('heading', { name: 'Sin título' })).toBeVisible()
}

test('edita título, estado y etiquetas y luego filtra en la galería', async ({ page }) => {
  await connect(page)
  await uploadOneDrawing(page)

  await page.getByRole('heading', { name: 'Sin título' }).click()
  await expect(page.getByRole('link', { name: '← Volver' })).toBeVisible()

  const title = page.getByLabel('Título', { exact: true })
  await title.fill('Retrato de Ana')
  await title.blur()

  await page.getByLabel('Estado', { exact: true }).selectOption('boceto')
  await page.getByLabel('Etiquetas', { exact: true }).fill('amiga, escuela')
  await page.getByLabel('Etiquetas', { exact: true }).blur()

  await page.getByRole('link', { name: '← Volver' }).click()
  await expect(page.getByLabel('Buscar por título o notas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Retrato de Ana' })).toBeVisible()

  const search = page.getByLabel('Buscar por título o notas', { exact: true })
  await search.fill('retrato')
  await expect(page.getByRole('heading', { name: 'Retrato de Ana' })).toBeVisible()

  await search.fill('zzz')
  await expect(page.getByText('No hay obras con esos filtros.')).toBeVisible()
  await page.getByRole('button', { name: 'Quitar filtros' }).click()
  await expect(page.getByRole('heading', { name: 'Retrato de Ana' })).toBeVisible()

  await page.getByLabel('Estado', { exact: true }).selectOption('terminada')
  await expect(page.getByText('No hay obras con esos filtros.')).toBeVisible()
  await page.getByLabel('Estado', { exact: true }).selectOption('boceto')
  await expect(page.getByRole('heading', { name: 'Retrato de Ana' })).toBeVisible()
})

test('la búsqueda encuentra por etiqueta y por acentos', async ({ page }) => {
  await connect(page)
  await uploadOneDrawing(page)

  await page.getByRole('heading', { name: 'Sin título' }).click()
  await expect(page.getByRole('link', { name: '← Volver' })).toBeVisible()

  const title = page.getByLabel('Título', { exact: true })
  await title.fill('Gato dormido')
  await title.blur()
  await page.getByLabel('Etiquetas', { exact: true }).fill('mascotas')
  await page.getByLabel('Etiquetas', { exact: true }).blur()
  await page.getByRole('link', { name: '← Volver' }).click()
  await expect(page.getByLabel('Buscar por título o notas')).toBeVisible()

  await page.getByLabel('Buscar por título o notas', { exact: true }).fill('GATO')
  await expect(page.getByRole('heading', { name: 'Gato dormido' })).toBeVisible()

  await page.getByLabel('Buscar por título o notas', { exact: true }).fill('')
  await page.getByLabel('Etiqueta', { exact: true }).selectOption('mascotas')
  await expect(page.getByRole('heading', { name: 'Gato dormido' })).toBeVisible()

  await page.getByLabel('Etiqueta', { exact: true }).selectOption('')
  await page.getByLabel('Buscar por título o notas', { exact: true }).fill('dormidó')
  await expect(page.getByRole('heading', { name: 'Gato dormido' })).toBeVisible()

  await page.getByLabel('Buscar por título o notas', { exact: true }).fill('gatoo')
  await expect(page.getByText('No hay obras con esos filtros.')).toBeVisible()
})
