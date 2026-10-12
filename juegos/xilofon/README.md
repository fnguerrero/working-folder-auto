# Xilofón

Un xilofón de ocho láminas de colores para Valentín. Se toca con los dedos (varios a la vez), deslizando
de punta a punta hace glissando, y cada golpe hace saltar un bicho. Tres canciones conocidas se tocan
solas iluminando las láminas, para mirar y copiar. Sin puntaje, sin perder, sin menú: se abre y suena.

**Probar:** https://fnguerrero.github.io/working-folder-auto/juegos/xilofon/

**Estado:** terminado.

## Qué hace

- **Ocho láminas** (Do a Do agudo) de largo decreciente como un xilofón de verdad: apiladas con el
  celular parado, en fila con la compu o el celular acostado.
- **Sonido con WebAudio**, sin archivos: fundamental más dos parciales inarmónicos (los de una barra
  metálica, o los de marimba en modo madera) y un soplo de ruido como golpe de palillo. Botón para
  cambiar entre **Metal** y **Madera**; la elección se guarda.
- **Multitáctil**: cada dedo toca su lámina; arrastrar por las láminas hace glissando.
- **Bichos y chispas**: en cada golpe sube un animal (🐸🐥🐱🐶🐷🐮🦁🐘) con unas estrellitas que se
  limpian solas. Respeta `prefers-reduced-motion`.
- **Canciones**: Estrellita, el Himno de la alegría y Fray Santiago (Frère Jacques), en Do mayor dentro
  de una octava. Tocar el botón de nuevo o `Esc` las corta; también se cortan si se oculta la pestaña.
- **Teclado**: `1`–`8` o `A S D F G H J K`; `Enter` o espacio sobre una lámina enfocada; `Esc` para la canción.

## Decisiones

- Nada de botones de "empezar" ni capas: un nene de un año no las entiende y todo lo que no suena es
  una frustración. Los botones de canción y timbre quedan arriba, chicos, y no rompen nada si los toca.
- Las frecuencias son las de la escala temperada (La = 440 Hz). Los parciales de metal (×2.76 y ×5.4)
  son los de una barra libre uniforme; los de madera (×4 y ×9.2) imitan la afinación de marimba.
- `touch-action: none` y `overscroll-behavior: none` en todo el documento para que los manotazos no
  hagan zoom ni scroll; `user-scalable=no` por lo mismo.
- Los bichos son emojis del sistema (sin assets externos); se ven distinto según el dispositivo, y está bien.

## Cómo se prueba

```bash
node --check <(sed -n '/<script>/,/<\/script>/p' juegos/xilofon/index.html | sed '1d;$d')
npm i -D playwright && npx playwright install chromium   # una sola vez
node juegos/xilofon/tests/e2e.js
```

La prueba e2e corre en Chromium headless a 360×740 y a 1280×720: ocho láminas visibles y de al menos
44 px, sin scroll, orientación correcta, tocar con el mouse, glissando, teclado, adornos que se van
solos, timbre guardado tras recargar, canción que arranca y se corta, y sin errores de consola.

Lo que **no se pudo probar** en la nube: el sonido en sí (no hay salida de audio en headless) ni el
multitáctil real con varios dedos; la lógica de varios punteros a la vez está escrita con Pointer
Events y vale probarla en un celular.
