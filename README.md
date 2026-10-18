# Kuromi Likes Your Drawings — Mi Galería

Galería privada de dibujos para una sola usuaria. Especificación completa en
[SPEC.md](SPEC.md).

## Requisitos

- Node.js 22 o superior
- Una cuenta de Google Cloud con un Client ID de OAuth (ver más abajo)

## Puesta en marcha

1. Instalar dependencias:

   ```
   npm install
   ```

2. Crear el archivo `.env` a partir de `.env.example` y poner tu Client ID:

   ```
   VITE_GOOGLE_CLIENT_ID=tu-client-id
   VITE_IOS_STANDALONE=false
   ```

3. Arrancar en desarrollo:

   ```
   npm run dev
   ```

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (http://localhost:5173) |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run preview` | Sirve `dist/` en local |
| `npm run lint` | Analiza el código con oxlint |
| `npm run test` | Tests unitarios con Vitest |
| `npm run test:watch` | Vitest en modo vigilancia |
| `npm run test:e2e` | Flujos con Playwright (Chromium y WebKit) |

La primera vez hay que instalar los navegadores de Playwright:

```
npx playwright install chromium webkit
```

## Fase 0 — Esqueleto y prueba OAuth

### Hecho

- [x] Proyecto Vite + React + TypeScript (modo estricto)
- [x] Tailwind CSS con tokens de tema
- [x] PWA con `vite-plugin-pwa` (`display: "browser"` por defecto)
- [x] `HashRouter` para GitHub Pages
- [x] Estructura de carpetas (app, features/auth, features/drive, lib, i18n, theme)
- [x] Textos de interfaz en español (`src/i18n/es.ts`)
- [x] Google Identity Services: `initTokenClient` con scope `drive.file`,
      token solo en memoria e intento de renovación silenciosa
- [x] Drive API: búsqueda/creación de la carpeta raíz con `appProperties`
      (`kind=root`) y de las subcarpetas
- [x] Escritura/lectura de un JSON de prueba (subida multipart)
- [x] Interfaz mínima: conectar Drive, ver la carpeta raíz, guardar/leer prueba
- [x] Mensaje de ayuda si un bloqueador rompe el login
- [x] Tests unitarios (Vitest) y de flujo (Playwright, Chromium y WebKit)
- [x] Workflow de despliegue a GitHub Pages
- [x] Lista de prueba manual para iOS en [`docs/qa-ipad.md`](docs/qa-ipad.md)

### Pendiente (antes de la entrega)

- [ ] Prueba real en iOS (iPhone/iPad): login y comportamiento `display: browser`
- [ ] Verificar si Ecosia en la UE usa su propio motor en iOS
- [ ] Probar el flujo completo en dos navegadores (criterio de salida de Fase 0)
- [ ] Configurar `VITE_GOOGLE_CLIENT_ID` en GitHub Secrets para el despliegue

## Configuración de Google Cloud

1. Crear un proyecto en Google Cloud Console y habilitar la **Google Drive API**.
2. Configurar la pantalla de consentimiento OAuth (tipo **Externo**) con el
   scope `https://www.googleapis.com/auth/drive.file`.
3. Publicar la app ("En producción"). En modo "Testing" la sesión caduca a
   los 7 días.
4. Crear una credencial **ID de cliente OAuth** de tipo "Aplicación web" con
   estos orígenes autorizados:
   - `http://localhost:5173`
   - `https://<usuario>.github.io`
5. Copiar el Client ID a `.env` (`VITE_GOOGLE_CLIENT_ID`). Es público y puede
   ir en el repositorio.

## Despliegue

Cada push a `main` dispara el workflow de GitHub Pages. Para activarlo:

1. Settings → Pages → Source: **GitHub Actions**.
2. Settings → Secrets and variables → Actions → añadir
   `VITE_GOOGLE_CLIENT_ID`.

## Nota sobre iOS

Por defecto la app se abre en iOS como una pestaña normal de Safari
(`display: "browser"` y sin `apple-mobile-web-app-capable`). El interruptor
`VITE_IOS_STANDALONE=true` activa el modo pantalla completa, pero no debe
usarse hasta probarlo en un iPhone o iPad real (el login de Google en modo
standalone tiene problemas conocidos).
