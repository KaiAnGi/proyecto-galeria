Kuromi Likes Your Drawings — Mi Galería
Galería privada de dibujos para una sola usuaria. Especificación completa en
[SPEC.md](SPEC.md).

## Estado de desarrollo

### Fase 0 — Esqueleto y pruebas de riesgo (hecha)
- PWA instalable (Vite + React + TypeScript, vite-plugin-pwa), desplegada en GitHub Pages.
- Login con Google (scope `drive.file`), token solo en memoria.
- Estructura de carpetas en Drive y archivo de prueba de lectura/escritura.
- iOS por defecto en modo navegador (`display: "browser"`); `VITE_IOS_STANDALONE`
  permite activar pantalla completa tras probarla en un dispositivo real.

### Fase 1 — Galería mínima útil (hecha)
- Subida desde archivo, cámara, arrastrar y pegar.
- Cuadrícula de obras y visor con zoom propio (Pointer Events).
- Edición de título y notas (se guardan en Drive).
- Borrado suave con "Deshacer"; al expirar, los archivos se mueven a la papelera de Drive.
- Imagen de galería ≤2400 px, miniatura y corrección de EXIF/HEIC.

### Fase 2 — Organización (hecha, menos los pares y las versiones)
- Colecciones y cuadernos, con vista de detalle y orden de páginas.
- Persistencia de colecciones en Drive (`_datos/colecciones/coleccion-<id>.json`).
- Búsqueda por título y notas (ignora mayúsculas y acentos).
- Filtros por estado, colección, técnica y etiqueta; los desplegables se rellenan
  con lo que hay en la galería y hay botón "Quitar filtros".
- Edición en la ficha de la obra: estado, técnicas y etiquetas (se guardan en Drive).
- Pendiente de esta fase: pares tradicional→digital y versiones con deslizador.

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
- Carga de obras/colecciones/secuencias/entregas desde Drive al iniciar sesión.
- Exportación a ZIP de los datos (obras, colecciones, secuencias y entregas).
- Altura dinámica (`100dvh`) y área segura (`env(safe-area-inset-*)`) para iPad.

## Pruebas
- Unitarias con Vitest: `npm run test` (34 pruebas: lógica de datos/Drive, media y filtros).
- E2E con Playwright: `npm run test:e2e`, cuatro proyectos:
  `chromium`, `webkit`, `ipad` (WebKit con iPad gen 7) y `ecosia` (Chromium con
  user agent de Ecosia). 46 pruebas (6 saltadas según el motor): OAuth simulado,
  subida real de GIF/vídeo con un Drive en memoria, entregas con recarga,
  búsqueda/filtros y edición de la ficha, controles táctiles ≥44 px,
  área segura/dvh y soporte de MP4 H.264.

## Pendiente
- Prueba real en iPad/Safari y en Ecosia (checklist en `docs/qa-ipad.md`).
- Fase 4 restante: estadísticas/racha, paleta por obra, moodboard y easter egg.
- Pruebas unitarias de la lógica de imagen (requieren simular `heic2any` y canvas).

## Desarrollo
Consulta `docs/qa-ipad.md` para el checklist de iOS/Ecosia.
