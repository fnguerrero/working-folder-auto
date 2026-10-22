# Diez segundos

Un corto de diez segundos para probar hasta dónde llega la gráfica sin librerías: un arroyo del Delta de noche, con
tormenta (lluvia, relámpagos con su rayo, truenos), una casa sobre pilotes con las ventanas prendidas y sauces en la
orilla, el agua con olas, reflejos y niebla, y al final amanece y aparece el título. Todo sale de **un único fragment
shader** en WebGL puro; el sonido (viento, lluvia, truenos, un acorde y un pájaro) se sintetiza con WebAudio.

**Ver:** https://fnguerrero.github.io/working-folder-auto/experimentos/diez-segundos/

**Estado:** terminado. Pedido de Nico en la sesión («una breve animación de 10 segundos con la mejor capacidad gráfica
que podés meterle para ver qué onda»).

## Qué hay

- `index.html`: el corto. Botón Reproducir (el sonido necesita un toque), Otra vez, «Grabar y descargar» (graba la
  reproducción con el audio a `.webm` con MediaRecorder, en el navegador) y una casilla de calidad (alta = la
  resolución del dispositivo hasta 2×; baja = 0,6×, para celulares que se queden cortos). `?t=4` dibuja el cuadro de
  los 4 segundos quieto, para pruebas.
- `diez-segundos.mp4` (2,6 MB): el corto renderizado a 1280×720 y 30 fps con el sonido, para verlo sin abrir la página o
  mandarlo por WhatsApp. Lo genera `render.js` (Chromium headless con WebGL por software + ffmpeg); el audio lo
  renderiza la misma página con `OfflineAudioContext` a WAV.
- `cuadro-noche.jpg` y `cuadro-amanecer.jpg`: dos fotogramas.
- `tests/corto.e2e.js`: Playwright a 360 y 1280 px: el shader compila, el cuadro de la noche y el del amanecer tienen
  imagen y son distintos, Reproducir arranca, sin scroll horizontal ni errores en consola.

## Cómo está hecho

- **Cielo:** gradiente noche → alba, nubes con FBM que se abren a medida que amanece, estrellas entre las nubes de
  noche, sol que sale detrás de la casa, destello general de cada relámpago.
- **Agua:** un plano; las olas son FBM animado y la normal sale por diferencias finitas; refleja el cielo y la
  silueta de la orilla (distorsionada por las olas), con Fresnel, brillo del sol y la luna, ondas y gotas de lluvia
  que desaparecen al amanecer, y niebla hacia el color del horizonte para que no se marque la línea.
- **Orilla:** casa, techo, galería, chimenea, muelle y pilotes como campos de distancia 2D; sauces como copas con
  ruido más una cortina de ramas colgantes que se mueven con el viento. Las ventanas parpadean y se apagan al amanecer.
- **Lluvia:** tres capas de estrías en diagonal, en espacio de pantalla, que se van entre los 4,5 y los 8,5 s.
- **Rayo:** tres relámpagos en instantes fijos (así el corto es siempre el mismo), cada uno con doble destello y una
  línea quebrada con una rama secundaria.
- **Cámara:** leve avance y balanceo. Viñeta, grano, tonemap suave, fundido de entrada y de salida.
- **Sonido:** ruido blanco con un pasabanda que baila (viento) y un pasaaltos (lluvia), ruido grave con envolvente
  después de cada relámpago (truenos), un acorde de Re mayor con sexta que entra a los 6,5 s y un pájaro a los 8,6 s.

## Cómo se prueba

```
NODE_PATH=/opt/node-tools/node_modules node experimentos/diez-segundos/tests/corto.e2e.js
NODE_PATH=/opt/node-tools/node_modules node experimentos/diez-segundos/render.js     # regenera el .mp4 (tarda unos minutos)
```

## Qué no se pudo probar

- El rendimiento en un celular real: en la nube se renderiza por software. En un celular de gama media debería andar a
  30 fps en calidad alta; si va a los saltos, destildar «Calidad alta».
- El botón «Grabar y descargar» depende de MediaRecorder con canvas: anda en Chrome y Firefox de escritorio y en
  Android; en iPhone Safari puede no estar.
