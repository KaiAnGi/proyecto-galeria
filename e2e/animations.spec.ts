import { test, expect, type Page } from '@playwright/test'
import { stubGis, stubDriveMemory } from './helpers'

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

async function connect(page: Page): Promise<void> {
  await stubGis(page)
  await stubDriveMemory(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Conectar mi Drive' }).click()
  await expect(page.getByText('Carpeta raíz:')).toBeVisible()
}

test('creates an animation and opens the editor', async ({ page }) => {
  await connect(page)

  await page.goto('/#/animaciones')
  await page.getByRole('button', { name: 'Nueva animación' }).click()
  await page.locator('input[type="file"]').first().setInputFiles([
    { name: 'a.png', mimeType: 'image/png', buffer: PNG_1PX },
    { name: 'b.png', mimeType: 'image/png', buffer: PNG_1PX },
  ])

  await expect(page.getByText('2 fotogramas elegidos')).toBeVisible()
  await page.getByPlaceholder('Título').fill('Prueba')
  await page.getByRole('button', { name: 'Crear animación (2 fotogramas)' }).click()

  await expect(page).toHaveURL(/#\/animaciones\/.+/)
  await expect(page.getByLabel('Título de la animación')).toHaveValue('Prueba')
  await expect(page.getByRole('button', { name: 'Fotograma 2', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Reproducir' }).click()
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
  await page.getByRole('button', { name: 'Pausar' }).click()

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'c.png',
    mimeType: 'image/png',
    buffer: PNG_1PX,
  })
  await expect(page.getByRole('button', { name: 'Fotograma 3', exact: true })).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: 'Quitar este fotograma' }).first().click()
  await expect(page.getByRole('button', { name: 'Fotograma 3', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.getByRole('button', { name: 'Fotograma 3', exact: true })).toBeVisible()

  await page.getByRole('link', { name: '← Volver' }).click()
  await expect(page.getByRole('heading', { name: 'Prueba' })).toBeVisible()
})
