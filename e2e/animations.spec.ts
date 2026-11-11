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
  await expect(page.getByText('¡Descubre todos los easter eggs!')).toBeVisible()
}

async function createDraft(page: Page, frameCount = 2): Promise<void> {
  await page.goto('/#/animaciones')
  await page.getByRole('button', { name: 'Nueva animación' }).click()
  const frames = Array.from({ length: frameCount }, (_, index) => ({
    name: `${index + 1}.png`,
    mimeType: 'image/png',
    buffer: PNG_1PX,
  }))
  await page.locator('input[type="file"]').first().setInputFiles(frames)
  await expect(page.getByText(`${frameCount} fotogramas elegidos`)).toBeVisible()
  await page.getByPlaceholder('Título').fill('Prueba')
  await page.getByRole('button', { name: `Abrir editor (${frameCount} fotogramas)` }).click()
  await expect(page).toHaveURL(/#\/animaciones\/.+/)
  await expect(page.getByLabel('Título de la animación')).toHaveValue('Prueba')
}

test('creates and edits an animation before saving', async ({ page }) => {
  await connect(page)
  await createDraft(page)

  await expect(page.getByRole('button', { name: 'Fotograma 2', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reproducir' }).click()
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
  await page.getByRole('button', { name: 'Pausar' }).click({ force: true })

  await page.locator('input[type="file"]').first().setInputFiles({
    name: '3.png',
    mimeType: 'image/png',
    buffer: PNG_1PX,
  })
  await expect(page.getByRole('button', { name: 'Fotograma 3', exact: true })).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: 'Quitar este fotograma' }).first().click()
  await expect(page.getByRole('button', { name: 'Fotograma 3', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.getByRole('button', { name: 'Fotograma 3', exact: true })).toBeVisible()

  const savedNames = await page.evaluate(() => {
    const files = JSON.parse(sessionStorage.getItem('e2e-drive-files') || '[]') as Array<{ name: string }>
    return files.map((file) => file.name)
  })
  expect(savedNames).not.toContain('Prueba')
})

test('saves the video and frames into a Drive folder', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'This WebKit build cannot record canvas video')
  await connect(page)
  await createDraft(page)

  await page.getByRole('button', { name: 'Guardar animación' }).click()
  await expect(page.getByText('Animación guardada')).toBeVisible({ timeout: 30000 })

  const saved = await page.evaluate(() => {
    const files = JSON.parse(sessionStorage.getItem('e2e-drive-files') || '[]') as Array<{
      id: string
      name: string
      mimeType: string
      parents?: string[]
    }>
    const folder = files.find(
      (file) => file.name === 'Prueba' && file.mimeType === 'application/vnd.google-apps.folder',
    )
    const framesFolder = files.find((file) => file.name === 'Fotogramas' && file.parents?.includes(folder?.id ?? ''))
    const originalsFolder = files.find(
      (file) => file.name === 'Originales' && file.parents?.includes(folder?.id ?? ''),
    )
    const video = files.find((file) => file.parents?.includes(folder?.id ?? '') && file.mimeType.startsWith('video/'))
    const frames = files.filter(
      (file) => file.parents?.includes(framesFolder?.id ?? '') && file.mimeType.startsWith('image/'),
    )
    const originals = files.filter((file) => file.parents?.includes(originalsFolder?.id ?? ''))
    return { folder: Boolean(folder), video: Boolean(video), frames: frames.length, originals: originals.length }
  })
  expect(saved).toEqual({ folder: true, video: true, frames: 2, originals: 2 })

  await page.getByRole('link', { name: '← Volver' }).click()
  await expect(page.getByRole('heading', { name: 'Prueba' })).toBeVisible()
})
