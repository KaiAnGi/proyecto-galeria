Kuromi Likes Your Drawings — Mi Galería
Galería privada de dibujos para una sola usuaria. Especificación completa en
[SPEC.md](SPEC.md).

## Estado de desarrollo

### Fase 0 — Esqueleto y pruebas de riesgo (hecha)
- PWA instalable (Vite + React + TypeScript, vite-plugin-pwa), desplegada en GitHub Pages.
- Login con Google (scope `drive.file`), token en memoria y `sessionStorage` con caducidad. Sin ventana al arrancar: el primer toque renueva; nunca se guarda en `localStorage`.
- Estructura de carpetas en Drive y archivo de prueba de lectura/escritura.
- iOS por defecto en modo navegador (`display: "browser"`); `VITE_IOS_STANDALONE`
  permite activar pantalla completa tras probarla en un dispositivo real.

### Fase 1 — Galería mínima útil (hecha)
- Subida desde archivo, cámara, arrastrar y pegar.
- Cuadrícula de obras y visor con zoom propio (Pointer Events).
- Edición de título y notas (se guardan en Drive).
- Borrado suave con "Deshacer" durante 7 s y una barra común para todos los borrados pendientes; al expirar, los archivos se mueven a la papelera de Drive.
- Imagen de galería ≤2048 px calidad 0.8, miniatura derivada de la galería y corrección de orientación EXIF al decodificar (`createImageBitmap`), con conversión de HEIC.

### Fase 2 — Organización (hecha)
- Colecciones y cuadernos, con vista de detalle y orden de páginas. Desde el detalle se añaden o quitan obras y animaciones, se borra la colección (también su carpeta en Drive, sin borrar los dibujos) y se vuelve a Colecciones.
- Persistencia de colecciones en Drive (`_datos/colecciones/coleccion-<id>.json`).
- Búsqueda por título y notas (ignora mayúsculas y acentos).
- Filtros por estado, colección, técnica y etiqueta; los desplegables se rellenan
  con lo que hay en la galería y hay botón "Quitar filtros".
- Edición en la ficha de la obra: estado, técnicas y etiquetas (se guardan en Drive).
- Pares tradicional→digital y versiones con línea de tiempo y deslizador antes/después.
- Añadir versiones (imagen/GIF) con tipo, etapa y guardado en Drive.

### Fase 3 — Animación y clase (hecha)
- Pencil test: subida de fotogramas en orden, reproducción de 6 a 24 fps con bucle,
  papel cebolla (fotograma anterior al 40 %) y reordenación de fotogramas.
- Persistencia de secuencias en Drive (`_datos/secuencias/secuencia-<id>.json`).
- Subida de GIF y vídeo (MP4/MOV/WebM): el original en `originales`, la miniatura en
  `miniaturas`; en la ficha de la obra, reproductor con reproducir/pausa, velocidad
  (0,25x–2x) y paso de fotograma.
- Entregas de clase (`#/entregas`): fecha límite con aviso de plazo, estado
  (pendiente/en curso/entregada), obras enlazadas y persistencia en
  `_datos/entregas/entrega-<id>.json`.

### Fase 4 — Pulido y extras (parcial)
- Sesión que sobrevive recargas con `sessionStorage`; al cerrar la pestaña el menú sigue disponible y el primer toque renueva con Google sin volver a la bienvenida.
- Carga de obras/colecciones/secuencias/entregas desde Drive al iniciar sesión, tolerante a fallos parciales por carpeta.
- Guardados en cola con aviso de "Guardando…", error visible y botón para reintentar; los cambios se envían en orden.
- Subida de obras más rápida: IDs de carpetas cacheados (se invalidan si Drive responde 401), miniatura/galería/original en paralelo, 2 obras simultáneas y reintento con espera ante 403/429.
- Animaciones: selector de fotogramas con contador, reinicio y progreso; subida paralela de miniatura, galería y original por fotograma.
- Exportación a ZIP real: datos, imágenes originales, galería, miniaturas, versiones y fotogramas.
- Iconos PWA generados desde `public/icon.png` (`npm run generate-pwa-assets`), con icono normal, `maskable` y `apple-touch-icon`.
- Altura dinámica (`100dvh`) y área segura (`env(safe-area-inset-*)`) para iPad.
- Rediseño visual completo (SPEC §10): tipografías autoalojadas DynaPuff (títulos)
  y Fredoka (texto) bajo licencia SIL OFL, fondo con degradados y damero suave,
  botones con efecto 3D al pulsar, tarjetas y fichas tipo pegatina, stickers SVG
  100 % originales (mascota de bufón, calavera con lazo, estrellas, corazones,
  murciélago, luna), iconos propios, cursor de corazón en escritorio y animaciones
  cortas que respetan `prefers-reduced-motion`. Favicon propio (calavera con lazo).
- Toda la tipografía de interfaz vive en `src/i18n/es.ts`; se extrajeron los textos
  que estaban sueltos en Colecciones, ColeccionDetail y Pencil test.
- Los personajes oficiales de `public/` se usan solo en esta galería privada; no se redistribuyen.

## Pruebas
- Unitarias con Vitest: `npm run test` (90 pruebas: autenticación/sesión, datos/Drive, caché de carpetas, concurrencia, reintentos, carga parcial, detalle de colecciones, colas de guardado y borrado, ZIP, subida de fotogramas, media y filtros).
- Comprobaciones de cierre: `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint` y `npm run build`.
- E2E con Playwright: `npm run test:e2e`, cuatro proyectos: `chromium`, `webkit`, `ipad` (WebKit con iPad gen 7) y `ecosia` (Chromium con user agent de Ecosia). La suite existente no se ha actualizado tras los cambios de sesión, guardado y borrado; revisarla antes de darla por buena.

## Pendiente
- Prueba real en iPad/Safari y en Ecosia (checklist en `docs/qa-ipad.md`): renovación al primer toque, popups, EXIF, descarga del ZIP e instalación PWA.
- Actualizar la suite E2E a la nueva sesión y a las colas de guardado/borrado.
- Fase 4 restante: estadísticas/racha, paleta por obra, moodboard y easter egg.
- Pruebas unitarias de la lógica de imagen (requieren simular `heic2any` y canvas).

## Desarrollo
Consulta `docs/qa-ipad.md` para el checklist de iOS/Ecosia.
