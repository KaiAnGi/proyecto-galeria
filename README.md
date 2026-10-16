# KLYD - Mi Galería

Galería privada de dibujos.

## Fase 0 - Esqueleto y prueba OAuth

### Hecho
- [x] Proyecto Vite + React + TypeScript estricto
- [x] Tailwind CSS con tokens de tema
- [x] PWA configurado con vite-plugin-pwa (display: browser por defecto)
- [x] HashRouter para GitHub Pages
- [x] Estructura de carpetas (app, features/auth, features/drive, lib, i18n, theme)
- [x] i18n español (es.ts)
- [x] Google Identity Services - initTokenClient con scope drive.file, login_hint, renovación silenciosa
- [x] Drive API - búsqueda/creación de carpeta raíz con appProperties (kind=root), creación de subcarpetas
- [x] Escritura/lectura de JSON de prueba (multipart upload)
- [x] UI mínima: conectar Drive, mostrar carpeta raíz, guardar/leer prueba
- [x] Detección de bloqueador con mensaje en español
- [x] Vitest + Playwright configurados
- [x] Workflow de despliegue a GitHub Pages
- [x] Repo renombrado a proyecto-galeria y puesto en público

### Pendiente (antes de entrega)
- [ ] Prueba real en iOS (iPhone/iPad) - login y comportamiento display: browser
- [ ] Verificar Ecosia en UE usa motor propio (o no) para iOS
- [ ] Configurar VITE_GOOGLE_CLIENT_ID en GitHub Secrets (para despliegue)
- [ ] Probar flujo completo con dos navegadores (criterio salida Fase 0)

### Configuración
1. Crear proyecto en Google Cloud Console, habilitar Google Drive API
2. Crear OAuth Client ID (Aplicación web) con orígenes: http://localhost:5173, https://KaiAnGi.github.io
3. Copiar Client ID a .env: VITE_GOOGLE_CLIENT_ID=tu-client-id
4. pm install && npm run dev

### Despliegue
Push a main dispara workflow. Configurar GitHub Pages: Settings > Pages > Source: GitHub Actions. Añadir VITE_GOOGLE_CLIENT_ID en Settings > Secrets and variables > Actions.
