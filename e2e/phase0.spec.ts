import { test, expect } from '@playwright/test'
import { stubGis, stubDriveMemory } from './helpers'

test('conecta el Drive y muestra la pantalla principal', async ({ page }) => {
  await stubGis(page)
  await stubDriveMemory(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kuromi likes your drawings!' })).toBeVisible()

  await page.getByRole('button', { name: 'Conectar mi Drive' }).click()
  await expect(page.getByText('¡Descubre todos los easter eggs!')).toBeVisible()
})

test('arranca en modo navegador, sin etiquetas de pantalla completa', async ({ page }) => {
  await page.goto('/')
  const html = await page.content()
  expect(html).not.toContain('apple-mobile-web-app-capable')
})
