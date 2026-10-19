import { test, expect, type Page } from '@playwright/test'
import { stubGis, stubDriveMemory } from './helpers'

const INTERACTIVE = 'a, button, input, select, textarea'

async function connect(page: Page): Promise<void> {
  await stubGis(page)
  await stubDriveMemory(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Conectar mi Drive' }).click()
  await expect(page.getByText('Carpeta raíz:')).toBeVisible()
}

async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate((selector) => {
    const bad: string[] = []
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      if (rect.height < 44 || rect.width < 44) {
        const label = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40)
        bad.push(`${label} ${Math.round(rect.width)}x${Math.round(rect.height)}`)
      }
    }
    return bad
  }, INTERACTIVE)
}

test('la app se ajusta a la altura dinámica y al área segura', async ({ page }) => {
  await page.goto('/')

  const info = await page.evaluate(() => {
    const rules: string[] = []
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          rules.push(rule.cssText || '')
        }
      } catch {
        // hoja externa no accesible
      }
    }
    const css = rules.join('\n')
    const rect = document.body.getBoundingClientRect()
    return {
      hasSafeArea: css.includes('env(safe-area-inset'),
      hasDvh: css.includes('100dvh'),
      bodyHeight: rect.height,
      viewportHeight: window.innerHeight,
      bodyWidth: rect.width,
      clientWidth: document.documentElement.clientWidth,
    }
  })

  expect(info.hasSafeArea).toBe(true)
  expect(info.hasDvh).toBe(true)
  expect(Math.abs(info.bodyHeight - info.viewportHeight)).toBeLessThanOrEqual(2)
  expect(Math.abs(info.bodyWidth - info.clientWidth)).toBeLessThanOrEqual(2)
})

test('los controles táctiles llegan a 44px en las tres pantallas', async ({ page }) => {
  await connect(page)

  expect(await smallTargets(page)).toEqual([])

  await page.goto('/#/galeria')
  await page.getByRole('button', { name: 'Añadir dibujo' }).click()
  expect(await smallTargets(page)).toEqual([])

  await page.goto('/#/entregas')
  expect(await smallTargets(page)).toEqual([])
})

test('los tres caminos de subida están en la pantalla', async ({ page }) => {
  await connect(page)

  await page.goto('/#/galeria')
  await page.getByRole('button', { name: 'Añadir dibujo' }).click()

  await expect(page.getByText('Fotografiar dibujo')).toBeVisible()
  await expect(page.getByText('Elegir de la galería')).toBeVisible()
  await expect(page.getByText('Arrastra imágenes, pégalas o usa uno de estos botones.')).toBeVisible()
})

test('el proyecto iPad arranca con pantalla táctil', async ({ page }) => {
  const project = test.info().project
  test.skip(project.name !== 'ipad', 'comprobación propia del proyecto iPad')

  await page.goto('/')

  const caps = await page.evaluate(() => ({
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    width: window.innerWidth,
    ua: navigator.userAgent,
  }))

  expect(caps.touch).toBe(true)
  expect(caps.width).toBeGreaterThanOrEqual(700)
  expect(caps.ua).toContain('iPad')
  expect((project.use as { defaultBrowserType?: string }).defaultBrowserType).toBe('webkit')
  await expect(page.getByRole('heading', { name: 'Mi Galería' })).toBeVisible()
})

test('el proyecto Ecosia arranca en un navegador Chromium', async ({ page }) => {
  const project = test.info().project
  test.skip(project.name !== 'ecosia', 'comprobación propia del proyecto Ecosia')

  await page.goto('/')

  const info = await page.evaluate(() => ({
    ua: navigator.userAgent,
    // userAgentData solo existe en motores Chromium
    engineChromium: typeof navigator.userAgentData === 'object' && navigator.userAgentData !== null,
  }))

  expect(info.ua).toContain('Ecosia')
  expect(info.ua).toContain('Chrome/')
  expect(info.engineChromium).toBe(true)
  expect((project.use as { defaultBrowserType?: string }).defaultBrowserType).toBe('chromium')
  await expect(page.getByRole('heading', { name: 'Mi Galería' })).toBeVisible()
})
