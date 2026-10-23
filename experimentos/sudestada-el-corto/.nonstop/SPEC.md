# Sudestada, el corto: spec

Pedido #15 (`noche`, `grande`): https://github.com/fnguerrero/working-folder-auto/issues/15

## Objetivo

Un corto animado de 2 a 4 minutos, con sonido, que adapte imágenes y momentos de la novela
[Sudestada](../../../escritos/sudestada/) con el motor que quedó armado en [Diez segundos](../../diez-segundos/):
WebGL puro, un fragment shader por escena con raymarching para lo que tiene volumen, sonido sintetizado con WebAudio y
render a `.mp4`. Lo que más le importa a Nico: que se vea lo más real posible dentro de lo que da el método (una
animación 3D bien iluminada) y que las personas no parezcan muñecos geométricos.

## Alcance

- `index.html`: reproduce el corto entero en el navegador. Una escena por shader, con cortes y fundidos, intertítulos,
  barra de tiempo con la que se puede saltar, lista de escenas, calidad automática (como en Diez segundos), grabar a
  `.webm` y link al `.mp4`.
- `render.js`: render a 1280×720 y 30 fps con Chromium headless (SwiftShader) y ffmpeg. Como una noche no alcanza para
  renderizar todo por software, se renderiza **de a una escena** a `video/escena-NN.mp4` (sin audio, quedan en el repo)
  y `render.js armar` concatena los segmentos y les pega el audio renderizado con `OfflineAudioContext`. Así el `.mp4`
  se va completando noche a noche.
- Nueve escenas (ver `GUION.md`), tres personajes con la misma técnica del remero: Martín (el remero de Diez segundos,
  ahora con gorra y barba de cuatro días), Verónica y Ana.
- Mejoras del motor que valen para todas las escenas: rig de persona parametrizado por postura (articulaciones) y
  aspecto (mujer/hombre, pelo, barba, gorra, sombrero, ropa), agua con nivel variable y espuma contra lo que flota,
  lluvia que golpea el agua y las superficies, cielo con tres regímenes (noche de tormenta, día gris de sudestada,
  amanecer), hasta cuatro luces puntuales por escena (farol, ventanas, vela, linterna), niebla por escena.

## Criterios de terminado (del issue)

- [ ] Guion por escenas en `.nonstop/GUION.md`, con duración y sonido de cada una.
- [ ] El corto se reproduce entero en el navegador desde la vitrina, a 360 px y en escritorio, con sonido y calidad automática.
- [ ] Hay un `.mp4` descargable de 2 a 4 minutos, 1280×720, 30 fps, con el audio.
- [ ] Hay al menos seis escenas distintas y dos personajes.
- [ ] Cargado en `proyectos.json`, README del proyecto con qué se pudo probar y qué no.

## Decisiones técnicas

- **Carpeta:** `experimentos/sudestada-el-corto/`. Es ante todo un experimento de gráfica (continúa Diez segundos); la
  novela queda en `escritos/` y los dos se enlazan.
- **Un shader por escena**, armado en JS como `cabecera (defines de la escena) + comun + escena + main`. `comun` trae la
  librería (ruido, SDF, rigs de persona, casa, muelle, sauces, cielo, agua, iluminación) y declara los prototipos que
  cada escena define: `mapaMundo`, `camara`, `clima`, `nivelAgua`, `luz(i)`. Cada escena compila solo lo que usa,
  así anda más rápido que el shader único de Diez segundos. Los programas se compilan al reproducir, de a uno, con la
  escena siguiente precompilada mientras corre la actual.
- **Transiciones:** cortes y fundidos a negro, hechos en el shader con `uFundido`. No hay fundidos encadenados entre
  dos escenas (habría que dibujar las dos en texturas y mezclarlas; no vale el costo).
- **Intertítulos:** texto en HTML sobre el canvas (fuente serif, como los carteles del cine mudo), con las frases de la
  novela. Sin voces: ni TTS (no suena igual en cada aparato y no entra en el `.mp4`) ni audio grabado (sin assets).
  El `.mp4` los lleva porque `render.js` captura el marco entero, no solo el canvas.
- **Sonido:** todo sintetizado en `programar(ctx, maestro, T0, desde)`: viento, lluvia, truenos, motor de la lancha,
  remada, goteo, madera que trabaja, perro, puerta de chapa, pájaros, y un motivo musical corto (piano sintetizado,
  Re menor) que vuelve en tres escenas. `desde` permite saltar en la línea de tiempo sin que suenen los eventos pasados.
- **Tiempo:** `uT` es el tiempo local de la escena; el reproductor lleva el global. Relámpagos y cortes de luz vienen de
  JS (`uFlash`, `uRayo`) con instantes fijos para que la película sea siempre la misma.
- **Calidad automática:** igual que Diez segundos (mide ms por cuadro, baja o sube la escala de render entre 0,3× y
  1,5×); en el render y en los tests se fija en 1×.
- **Tests:** `tests/corto.e2e.js` (Playwright, 360 y 1280 px): cada escena compila y su cuadro de prueba tiene
  imagen, Reproducir arranca, saltar en la barra cambia de escena, sin scroll horizontal ni errores en consola.
  `tests/ver.js` es la herramienta de desarrollo: renderiza un cuadro de una escena a PNG para mirarlo.

## Supuestos

- El corto no cuenta la trama entera: elige nueve imágenes en orden y deja que los intertítulos (frases de la
  novela) y la música lleven el hilo. Quien leyó la novela reconoce cada momento; quien no, ve una historia de una
  casa sobre pilotes, una crecida y un farol en el agua.
- Las personas se ven de lejos o de espaldas casi siempre; las caras aparecen en dos planos (Verónica en el muelle,
  Martín bajo el farol) con el rig de cara de Diez segundos. Nico pidió que no parezcan muñecos: se cuida la luz
  (contraluz, farol) y las proporciones antes que el detalle fino.
- Duración objetivo: 3 minutos (180 s), repartidos como dice `GUION.md`. Si una escena no llega a quedar bien se
  acorta antes que dejarla fea.
- Resolución del `.mp4`: 1280×720 a 30 fps, segmentos por escena en `video/` con `libx264 crf 23`, concatenados sin
  recodificar.
- El agua es siempre un plano horizontal (`nivelAgua(t)`), también adentro de la casa en la escena de la escalera.
