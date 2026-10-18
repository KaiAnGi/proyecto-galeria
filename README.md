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

### Fase 2 — Organización (hecha)
- Colecciones y cuadernos, con vista de detalle y orden de páginas.
- Persistencia de colecciones en Drive (`_datos/colecciones/coleccion-<id>.json`).

### Fase 3 — Animación (hecha)
- Pencil test: subida de fotogramas en orden, reproducción de 6 a 24 fps con bucle,
  papel cebolla (fotograma anterior al 40 %) y reordenación de fotogramas.
- Persistencia de secuencias en Drive (`_datos/secuencias/secuencia-<id>.json`).

### Fase 4 — Pulido y extras (parcial)
- Carga de obras/colecciones/secuencias desde Drive al iniciar sesión.
- Exportación a ZIP de los datos (obras, colecciones y secuencias).

## Pendiente
- Prueba real en iPad/Safari y en Ecosia (checklist en `docs/qa-ipad.md`).
- Fase 4 restante: estadísticas/racha, paleta por obra, moodboard y easter egg.
- Fase 3 restante: soporte de GIF/MP4 y entregas de clase.
- Pruebas unitarias de la lógica de imagen (requieren simular `heic2any` y canvas).

## Desarrollo
Consulta `docs/qa-ipad.md` para el checklist de iOS/Ecosia.
