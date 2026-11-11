import { test, expect, type Page } from '@playwright/test'
import { stubGis, stubDriveMemory } from './helpers'

const RED_8PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAUSURBVChTY/jPwPAfHx4RChj+AwDC13+BykaqugAAAABJRU5ErkJggg==',
  'base64',
)

async function connect(page: Page): Promise<void> {
  await stubGis(page)
  await stubDriveMemory(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Conectar mi Drive' }).click()
  await expect(page.getByText('¡Descubre todos los easter eggs!')).toBeVisible()
}

test('extrae y guarda la paleta de una obra', async ({ page }) => {
  await connect(page)

  await page.goto('/#/galeria')
  await page.getByRole('button', { name: 'Añadir dibujo' }).click()
  await page.locator('input[type="file"][multiple]').setInputFiles({
    name: 'rojo.png',
    mimeType: 'image/png',
    buffer: RED_8PX,
  })
  await expect(page.getByRole('heading', { name: 'Sin título' })).toBeVisible()
  await page.getByRole('heading', { name: 'Sin título' }).click()

  await page.getByRole('button', { name: 'Extraer colores' }).click()
  await expect(page.getByRole('img', { name: '#ff0000' })).toBeVisible()
})
