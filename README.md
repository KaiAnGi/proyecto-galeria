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
- Persistencia de colecciones en Drive (`_interno/colecciones/coleccion-<id>.json`).
- Carpetas de colección visibles en la raíz con la imagen principal de cada obra;
  "Sin colección" recoge lo que aún no pertenece a ninguna.
- Búsqueda por título y notas (ignora mayúsculas y acentos).
- Filtros por estado, colección, técnica y etiqueta; los desplegables se rellenan
  con lo que hay en la galería y hay botón "Quitar filtros".
- Edición en la ficha de la obra: estado, técnicas y etiquetas (se guardan en Drive).
- Pares tradicional→digital y versiones con línea de tiempo y deslizador antes/después.
- Añadir versiones (imagen/GIF) con tipo, etapa y guardado en Drive.

### Fase 3 — Animación y clase (hecha)
- Animaciones con biblioteca (`#/animaciones`) y editor (`#/animaciones/:id`); `/pencil-test` redirige a la biblioteca.
- Creación guiada en un panel aparte: archivo, arrastrar, pegar o cámara; vista previa, reordenación y borrado local antes de subir.
- Editor con transporte fijo, reproducción de 6 a 24 fps con presets, bucle, contador, barra de progreso y papel cebolla al 40 % solo en pausa.
- Línea de tiempo con miniaturas por `frame.id`, selección visible, desplazamiento automático, reordenación con Pointer Events o botones y adición de fotogramas.
- Quitar un fotograma usa la papelera y el "Deshacer" global de 7 s; nunca se puede dejar una animación sin fotogramas. Si cambia el primero, se actualiza la portada.
- Persistencia de secuencias en Drive (`_interno/secuencias/secuencia-<id>.json`) y firma `gifSignature` para detectar un GIF desfasado.
- Cada animación genera un GIF con los fotogramas en "Sin colección"; al editar se regenera y se actualiza el archivo existente (con subida de reemplazo si el PATCH falla). Los originales nuevos se suben en segundo plano con progreso visible.
- Subida de GIF y vídeo (MP4/MOV/WebM): el original en `originales`, la miniatura en
  `miniaturas`; en la ficha de la obra, reproductor con reproducir/pausa, velocidad
  (0,25x–2x) y paso de fotograma.
- Entregas de clase (`#/entregas`): fecha límite con aviso de plazo, estado
  (pendiente/en curso/entregada), obras enlazadas y persistencia en
  `_interno/entregas/entrega-<id>.json`.

### Fase 4 — Pulido y extras (parcial)
- Sesión que sobrevive recargas con `sessionStorage`; al cerrar la pestaña el menú sigue disponible y el primer toque renueva con Google sin volver a la bienvenida.
- Carga de obras/colecciones/secuencias/entregas desde Drive al iniciar sesión, tolerante a fallos parciales por carpeta.
- Guardados en cola con aviso de "Guardando…", error visible y botón para reintentar; los cambios se envían en orden.
- Subida de obras más rápida: IDs de carpetas cacheados (se invalidan si Drive responde 401), miniatura/galería/original en paralelo, 2 obras simultáneas y reintento con espera ante 403/429.
- Animaciones más rápidas: 3 fotogramas en paralelo, galería de 1024 px, GIF de 640 px con paleta compartida y originales que se suben en segundo plano sin bloquear la animación.
- Drive más claro: raíz "Kuromi Likes Your Drawings", carpeta "Sin colección" y una carpeta por colección con solo la imagen principal o el GIF; migración automática de `_datos`/`archivos`.
- Borrar una colección devuelve sus dibujos huérfanos a "Sin colección", y borrar una animación elimina sus fotogramas y su GIF.
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
- Unitarias con Vitest: `npm run test` (129 pruebas: autenticación/sesión, datos/Drive, estructura y migración de carpetas, concurrencia, reintentos, carga parcial, detalle de colecciones, biblioteca y editor de animaciones, colas de guardado y borrado, GIF y portada, tareas en segundo plano, ZIP, subida de fotogramas y originales diferidos, media y filtros).
- Comprobaciones de cierre: `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint` y `npm run build`.
- E2E con Playwright: `npm run test:e2e`, cuatro proyectos: `chromium`, `webkit`, `ipad` (WebKit con iPad gen 7) y `ecosia` (Chromium con user agent de Ecosia). Incluye la creación de una animación hasta su editor. La suite existente no se ha actualizado tras los cambios de sesión, guardado y borrado; revisarla antes de darla por buena.

## Pendiente
- Prueba real en iPad/Safari y en Ecosia (checklist en `docs/qa-ipad.md`): renovación al primer toque, popups, EXIF, descarga del ZIP e instalación PWA.
- Actualizar la suite E2E a la nueva sesión y a las colas de guardado/borrado.
- Fase 4 restante: estadísticas/racha, paleta por obra, moodboard y easter egg.
- Pruebas unitarias de la lógica de imagen (requieren simular `heic2any` y canvas).

## Desarrollo
Consulta `docs/qa-ipad.md` para el checklist de iOS/Ecosia.
