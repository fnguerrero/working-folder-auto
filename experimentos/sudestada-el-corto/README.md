# Sudestada, el corto

Una película animada de tres minutos a partir de la novela [Sudestada](../../escritos/sudestada/), hecha con el motor que
quedó armado en [Diez segundos](../diez-segundos/): WebGL puro, **un fragment shader por escena** con raymarching para lo
que tiene volumen, sonido sintetizado con WebAudio e intertítulos con frases de la novela, como los carteles del cine
mudo. Nueve escenas en orden: la lancha colectiva que entra al arroyo del Fraile, la casa con la puerta abierta y la toalla
en la baranda, el viento que gira, el agua que sube por la escalera, el hombre de la chata al amanecer, la chata que se da
vuelta, la luz en el galpón, el farol en el agua («Salí del agua, Martín») y el barro del final con el título.

**Ver:** https://fnguerrero.github.io/working-folder-auto/experimentos/sudestada-el-corto/

**Estado:** en curso (pedido #15, de varias noches). Lo que hay y lo que falta está en `.nonstop/CHECKLIST.md`; la cocina
(spec, guion por escenas, bitácora) en `.nonstop/`.

## Qué hay

- `index.html`: el reproductor. Reproduce el corto entero (183 s), con barra de tiempo para saltar, lista de escenas,
  calidad automática (mide cuánto tarda cada cuadro y baja o sube la resolución de render sola, de 0,3× a 1,5×; también
  se puede fijar), «Grabar y descargar» (a `.webm` con el audio, en el navegador) y link al `.mp4`. Las escenas que todavía
  no tienen shader propio se ven con el de la portada y salen atenuadas en la lista. `?t=90` dibuja el cuadro del segundo 90
  quieto; `?escena=8&t=14` el segundo 14 de la escena 8.
- `src/`: la fuente. `comun.glsl` es la librería (ruido, primitivas, el rig de persona por postura y aspecto, la chata, la
  lancha colectiva, la casa de dos plantas, el perro, los sauces, el cielo con tres regímenes, el agua, la iluminación y los
  materiales), `main.glsl` el `main()` común, `escenas/NN-*.glsl` una escena por archivo (cada una define el mundo, la
  cámara, el clima, el nivel del agua y las luces), `sonido.js` la síntesis y `reproductor.js` la línea de tiempo y el
  reproductor. `node build.js` arma `index.html` con todo adentro.
- `render.js`: renderiza a 1280×720 y 30 fps con Chromium headless (WebGL por software) y ffmpeg, **de a una escena**
  (`node render.js escena 8`), a `video/escena-NN.mp4`; `node render.js armar` concatena los segmentos que haya desde
  la escena 0 y les pega el audio renderizado con `OfflineAudioContext`. Por software un cuadro a 1280 px tarda de 30 a
  90 s según la escena (y a 640 px, de 3 a 6 s), así que los segmentos se hacen primero en **borrador a 640×360 escalado
  a 1280×720** (`node render.js escena 8 3 640`) y se van reemplazando por la versión a resolución completa noche a noche.
  `video/RESOLUCION.txt` dice cómo está renderizado cada uno; `sudestada-el-corto.mp4` es el armado más reciente.
- `tests/corto.e2e.js`: Playwright a 360 y 1280 px: compilan los shaders de las diez escenas, cada escena con shader propio
  tiene imagen, Reproducir arranca, saltar desde la lista cambia de escena, sin scroll horizontal ni errores en consola.
  `tests/ver.js` renderiza un cuadro de una escena a PNG, para mirarlo mientras se trabaja.

## Cómo está hecho

- **Personas:** un rig único (`persona(q, Pose, Aspecto)`): la postura son las articulaciones (cadera, pecho, hombros,
  codos, manos, rodillas, pies, hacia dónde se cierran los dedos, giro e inclinación de la cabeza) y el aspecto dice si es
  mujer u hombre, barba, pelo (corto, recogido o suelto y mojado, con volumen), gorra o sombrero, panza y ropa. La cabeza
  es la de Diez segundos (cráneo, mandíbula, pómulos, nariz, cuencas, cejas, orejas, labios) con ojos pintados (almendra,
  iris, pupila, pestañas) y proporciones distintas para Verónica y Ana. Las manos tienen palma, tres dedos y pulgar que se
  cierran sobre lo que agarran. Hay posturas base (de pie o caminando, sentada, remando) que cada escena ajusta.
- **Escenas:** el shader de cada una es `defines + comun + escena + main`; la escena define `mapaMundo`, `camara`,
  `clima` (luz, alba, nubes, lluvia, niebla, viento y corriente), `nivelAgua`, `luz(i)` (hasta cuatro luces puntuales
  con sombra suave) y `aguaExtra` (ondas de la estela, espuma y hojas). Los programas se compilan al reproducir, uno por
  escena, con la siguiente precompilada mientras corre la actual (`KHR_parallel_shader_compile` si está).
- **Sonido:** `sonidos()` es una caja de herramientas por escena: viento con ráfagas, lluvia, truenos, el motor diésel de
  la lancha, oleaje, corriente, pasos en madera, chapas y vidrios que vibran, goteo con reverberación, madera que trabaja,
  el grupo electrógeno, la radio AM sin palabras, la remada (palada, arrastre, golpe de horquilla), el perro, el vuelco,
  la puerta corrediza de chapa, pájaros, y un piano sintetizado para el motivo de cinco notas en Re menor que vuelve en
  tres escenas y resuelve en Re mayor al final. Saltar en la barra reprograma el sonido desde ese segundo.

## Cómo se prueba

```
cd experimentos/sudestada-el-corto && node build.js                                       # arma index.html desde src/
NODE_PATH=/opt/node-tools/node_modules node experimentos/sudestada-el-corto/tests/corto.e2e.js
NODE_PATH=/opt/node-tools/node_modules node experimentos/sudestada-el-corto/tests/ver.js 8 14 /tmp/cuadro.png   # un cuadro
NODE_PATH=/opt/node-tools/node_modules node experimentos/sudestada-el-corto/render.js escena 1       # un segmento del .mp4
NODE_PATH=/opt/node-tools/node_modules node experimentos/sudestada-el-corto/render.js armar          # el .mp4 con audio
```

## Qué no se pudo probar

- El rendimiento en una GPU real: en la nube se renderiza por software. Las escenas con personas cerca de cámara (la 2, la
  8) son las más pesadas; la calidad automática baja la resolución hasta que fluya, y en un celular conviene aceptar que
  se vea en baja.
- El sonido se escuchó solo como forma de onda renderizada sin parlantes (`OfflineAudioContext`); los niveles relativos
  pueden necesitar una pasada con auriculares.
- «Grabar y descargar» depende de MediaRecorder con canvas: anda en Chrome y Firefox de escritorio y en Android; en
  iPhone Safari puede no estar.
