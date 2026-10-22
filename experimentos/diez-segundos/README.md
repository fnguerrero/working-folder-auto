# Diez segundos

Un corto de diez segundos para probar hasta dónde llega la gráfica sin librerías: un hombre rema en una chata con un
farol en la proa por un arroyo del Delta, de noche, con tormenta (lluvia, relámpagos con su rayo, truenos); en la orilla
una casa sobre pilotes con las ventanas prendidas y sauces; el agua con olas, la estela, los reflejos del remero y del
farol, y niebla; y al final amanece y aparece el título. Todo sale de **un único fragment shader** en WebGL puro: el
bote y el hombre son geometría 3D real (campos de distancia con raymarching, con luz del farol, sombras suaves y
reflejos en el agua); el sonido (viento, lluvia, truenos, un acorde y un pájaro) se sintetiza con WebAudio.

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

- **La chata y el remero:** campos de distancia 3D (elipsoides, cápsulas, cilindros, cajas redondeadas, uniones y
  restas suaves) marchados por rayo, dentro de una esfera envolvente para no gastar pasos donde no hay nada. El casco
  es una caja afinada en las puntas y ahuecada. El hombre está sentado en el banco mirando a popa: torso con panza y
  hombros, cuello de campera, brazos con codo, manos con pulgar agarrando los remos, piernas con rodilla y botas de
  goma; la cabeza tiene cráneo, mandíbula, nariz, cejas, cuencas de los ojos, orejas y boca, con barba y pelo pintados
  por posición, y un sombrero con el ala levantada en los bordes. Los remos van de las manos por la chumacera hasta la
  pala y siguen el ciclo de la remada (2,4 s); el torso se echa atrás en el tirón. El bote cabecea y rola con las olas y
  avanza despacio; la cámara lo sigue y en la segunda mitad se le acerca hasta quedar a dos metros del hombre.
  Materiales: madera con veta mojada, campera con arrugas (la normal se perturba con ruido), piel que deja pasar la luz
  del farol cuando viene de atrás, fieltro, remos, botas y el farol, que es emisivo. Oclusión ambiental en los pliegues
  (cinco muestras a lo largo de la normal).
- **Luz:** el farol es una luz puntual cálida con sombras suaves (marcha corta hacia la luz), más luz ambiente del
  cielo, luz del sol al amanecer, un borde de contraluz y el destello azulado de cada relámpago desde arriba. El agua
  recibe la luz del farol y su reflejo largo, y refleja el bote y el hombre marchando el rayo reflejado.

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

- El rendimiento en un celular real: en la nube se renderiza por software. El raymarching del remero (con sombras y
  oclusión) es lo más pesado; en una compu con GPU anda fluido, en un celular de gama media conviene destildar
  «Calidad alta».
- El botón «Grabar y descargar» depende de MediaRecorder con canvas: anda en Chrome y Firefox de escritorio y en
  Android; en iPhone Safari puede no estar.
