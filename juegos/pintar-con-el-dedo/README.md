# Pintar con el dedo

Una pizarra para Valentín: se dibuja a pantalla completa con uno o varios dedos, hay ocho colores, tres
grosores y cinco sellos (sol, estrella, corazón, auto y flor) que suenan al estamparse. El dibujo se puede
guardar como PNG para mandárselo a la familia. Sin puntaje, sin final, sin publicidad ni enlaces.

**Probar:** https://fnguerrero.github.io/working-folder-auto/juegos/pintar-con-el-dedo/

**Estado:** terminado.

## Cómo se usa

| Qué | Con el dedo o mouse | Teclado |
|---|---|---|
| Dibujar | arrastrar (cada dedo hace su trazo) | |
| Color | botones redondos de abajo | `1` a `8` |
| Grosor (también cambia el tamaño del sello) | los tres puntos | `+` y `-` |
| Sello | botón del costado y tocar la pizarra; tocarlo otra vez (o elegir un color) vuelve al lápiz | |
| Borrar todo | 🗑️, esperar medio segundo y tocar «¿Borrar?» | |
| Guardar PNG | 💾 | |
| Silencio | 🔊 | `M` |

## Pensado para que no se rompa

- Borrar pide un segundo toque entre 0,45 y 3,5 segundos después del primero: una ráfaga de manotazos no
  alcanza, y dibujar cancela la confirmación. Con otro dedo apoyado en la pantalla, borrar y guardar no
  responden.
- El dibujo se guarda solo en el navegador (`localStorage`): si se recarga o se cierra, vuelve.
- Sin scroll, zoom, tirar para recargar ni menú de mantener apretado.
- El primer «Atrás» se absorbe; para salir hay que apretarlo dos veces seguidas.
- En el celular pasa a pantalla completa con el primer toque. `?ventana` lo desactiva y `?mudo` apaga el sonido.
- Guardar dos veces en menos de 3 segundos descarga una sola vez.

Una página web no puede bloquear los gestos del sistema ni el botón de inicio. Para eso, en Android está
«Fijar app» y en iPhone «Acceso guiado».

## Detalles

Un `index.html` autocontenido, sin dependencias ni archivos externos: canvas, sellos en SVG y sonidos
sintetizados con WebAudio. Al girar el celular el lienzo crece y no recorta lo dibujado.

## Cómo se prueba

Desde la raíz del repo, con Playwright disponible (`CANAL=msedge` usa el Edge instalado):

```bash
node juegos/pintar-con-el-dedo/tests/e2e.js
```

Corre sin ventanas y sin audio. Revisa la disposición en 8 tamaños (de 320×568 a 1280×720, botones de 56 px
o más sin pisarse), y a 360×740 táctil y 1280×720 con mouse y teclado: tres dedos a la vez, grosores,
sellos, guardado del PNG, autoguardado, giro de pantalla, borrado, silencio, «Atrás», pantalla completa y
apertura como archivo local.

**No se pudo probar:** cómo suena por parlantes (solo que cada sonido se dispare sin errores), un celular de
verdad (Android o iPhone, incluida la descarga del PNG y la pantalla completa), Safari y Firefox, ni con un
chico de un año. En iPhone no hay pantalla completa desde el navegador. En pantallas apaisadas de menos de
640 px de ancho los sellos pueden quedar encima de la barra de colores.
