import { test, expect, type Page } from '@playwright/test'

type StubConfig = {
  callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => void
}

async function mockGoogleAndDrive(page: Page) {
  await page.addInitScript(() => {
    ;(window as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: (config: StubConfig) => ({
            requestAccessToken: () =>
              config.callback({ access_token: 'e2e-token', expires_in: 3600 }),
          }),
        },
      },
    }
  })

  let rootId: string | null = null
  let folderSeq = 0

  await page.route('**/accounts.google.com/gsi/client', (route) => route.fulfill({ body: '' }))

  await page.route('**/upload/drive/v3/files**', (route) =>
    route.fulfill({
      json: {
        id: 'file-config',
        name: 'config.json',
        modifiedTime: new Date().toISOString(),
        appProperties: { kind: 'config' },
      },
    }),
  )

  await page.route('**/www.googleapis.com/drive/v3/files**', (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (request.method() === 'GET' && url.searchParams.get('alt') === 'media') {
      return route.fulfill({
        json: { schema: 1, rev: 1, test: true, message: 'Hola desde Mi Galería' },
      })
    }

    if (request.method() === 'POST') {
      const body = request.postDataJSON() as {
        name: string
        appProperties?: Record<string, string>
      }
      if (body.appProperties?.kind === 'root') {
        rootId = 'root-1'
        return route.fulfill({
          json: { id: 'root-1', name: body.name, appProperties: body.appProperties },
        })
      }
      folderSeq += 1
      return route.fulfill({
        json: { id: 'folder-' + folderSeq, name: body.name, appProperties: body.appProperties },
      })
    }

    const q = url.searchParams.get('q') ?? ''
    if (q.includes("value='root'")) {
      return route.fulfill({
        json: {
          files: rootId
            ? [{ id: rootId, name: 'Mis obras', appProperties: { kind: 'root' } }]
            : [],
        },
      })
    }
    if (q.includes('_datos')) {
      return route.fulfill({ json: { files: [{ id: 'folder-datos', name: '_datos' }] } })
    }
    if (q.includes('config.json')) {
      return route.fulfill({ json: { files: [{ id: 'file-config', name: 'config.json' }] } })
    }
    return route.fulfill({ json: { files: [] } })
  })
}

test('conecta el Drive, guarda y lee el archivo de prueba', async ({ page }) => {
  await mockGoogleAndDrive(page)

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Mi Galería' })).toBeVisible()

  await page.getByRole('button', { name: 'Conectar mi Drive' }).click()
  await expect(page.getByText('Carpeta raíz: root-1')).toBeVisible()

  await page.getByRole('button', { name: 'Guardar prueba' }).click()
  await page.getByRole('button', { name: 'Leer prueba' }).click()

  await expect(page.getByText('Hola desde Mi Galería')).toBeVisible()
})

test('arranca en modo navegador, sin etiquetas de pantalla completa', async ({ page }) => {
  await page.goto('/')
  const html = await page.content()
  expect(html).not.toContain('apple-mobile-web-app-capable')
})
