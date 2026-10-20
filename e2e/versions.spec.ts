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

test.describe('Versiones (pares y línea de tiempo)', () => {
  test('añadir versión digital y comparar antes/después', async ({ page }) => {
    await connect(page)
    await page.goto('/#/galeria')
    await page.getByRole('button', { name: 'Añadir dibujo' }).click()
    await page.locator('input[type="file"][multiple]').setInputFiles({
      name: 'papel.gif',
      mimeType: 'image/gif',
      buffer: GIF_1PX,
    })
    await expect(page.getByRole('heading', { name: 'Sin título' })).toBeVisible()
    await page.getByRole('heading', { name: 'Sin título' }).click()
    await expect(page.getByText('Versiones')).toBeVisible()
    await page.getByRole('button', { name: 'Añadir versión' }).click()
    await page.getByLabel('Está en').selectOption('digital')
    await page.getByLabel('Etapa').selectOption('final')
    await page.getByLabel('Elegir imagen de la versión').setInputFiles({
      name: 'digital.gif',
      mimeType: 'image/gif',
      buffer: GIF_1PX,
    })
    await expect(page.getByRole('button', { name: 'Final' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('button', { name: 'Digital' })).toBeVisible()
    await page.getByRole('button', { name: 'Comparar antes y después' }).click()
    await expect(page.getByRole('slider', { name: 'Desliza para comparar las dos imágenes' })).toBeVisible()
    await page.getByRole('slider', { name: 'Desliza para comparar las dos imágenes' }).focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')
    await page.getByRole('button', { name: 'Ver una sola' }).click()
    await expect(page.getByRole('slider')).not.toBeVisible()
  })

  test('persistencia al recargar', async ({ page }) => {
    await connect(page)
    await page.goto('/#/galeria')
    await page.getByRole('button', { name: 'Añadir dibujo' }).click()
    await page.locator('input[type="file"][multiple]').setInputFiles({
      name: 'papel.gif',
      mimeType: 'image/gif',
      buffer: GIF_1PX,
    })
    await expect(page.getByRole('heading', { name: 'Sin título' })).toBeVisible()
    await page.getByRole('heading', { name: 'Sin título' }).click()
    await page.getByRole('button', { name: 'Añadir versión' }).click()
    await page.getByLabel('Está en').selectOption('digital')
    await page.getByLabel('Etapa').selectOption('final')
    await page.getByLabel('Elegir imagen de la versión').setInputFiles({
      name: 'digital.gif',
      mimeType: 'image/gif',
      buffer: GIF_1PX,
    })
    await expect(page.getByRole('button', { name: 'Final' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('button', { name: 'Digital' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Digital' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Final' })).toBeVisible()
    await page.getByRole('button', { name: 'Comparar antes y después' }).click()
    await expect(page.getByRole('slider')).toBeVisible()
  })
})
