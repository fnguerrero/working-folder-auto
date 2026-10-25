# Sudestada, el corto

Una película animada a partir de la novela [Sudestada](../../escritos/sudestada/), hecha con el motor que quedó armado
en [Diez segundos](../diez-segundos/): WebGL puro, **un fragment shader por escena** con raymarching para lo que tiene
volumen, sonido sintetizado con WebAudio y **diálogos con voz** (sintetizadas con Piper, los únicos archivos de audio del
proyecto). La segunda versión del guion (`.nonstop/GUION.md`) sigue la novela de cerca en veinte escenas, unos diez
minutos: la lancha colectiva, la puerta abierta, Elías que avisa la sudestada, el viento que gira, el hombre de la chata,
el boleto en el taller, el agua por la escalera, la chata que se da vuelta, el pan, el señor Acuña, el mensaje de las 14.10,
la puerta con llave, la luz en el galpón, «ella», el farol en el agua, la cocina de Elías, el barro, la escribanía del
martes con las dos firmas juntas y el cierre con la moraleja. **Desde el 25/10 las veinte escenas tienen imagen propia**; lo que falta es pulirlas mirándolas en movimiento y
renderizar el `.mp4` del guion nuevo.

**Ver:** https://fnguerrero.github.io/working-folder-auto/experimentos/sudestada-el-corto/

**Estado:** en curso (pedido #15, de varias noches). Lo que hay y lo que falta está en `.nonstop/CHECKLIST.md`; la cocina
(spec, guion por escenas, bitácora) en `.nonstop/`.

## Qué hay

- `index.html`: el reproductor. Reproduce el corto entero (728 s con el guion nuevo), con barra de tiempo para saltar, lista de escenas,
  calidad automática (mide cuánto tarda cada cuadro y baja o sube la resolución de render sola, de 0,3× a 1,5×; también
  se puede fijar), «Grabar y descargar» (a `.webm` con el audio, en el navegador) y link al `.mp4`. `?t=90` dibuja el cuadro del segundo 90 quieto; `?escena=8&t=14` el segundo 14 de la escena 8.
- `voces/`: las líneas de diálogo (`lineas.json`: quién, en qué escena, desde cuándo, el texto y la duración real) y un
  `.ogg` por línea (Opus mono a 32 kb/s; las 109 líneas, cuatro minutos y medio de voz, pesan 1,5 MB). `generar.py` las sintetiza con
  [Piper](https://github.com/rhasspy/piper) (TTS neuronal, corre local) y ffmpeg: una voz por personaje (Verónica es
  `es_AR-daniela`, la única voz argentina de Piper; Ana la misma un 8 % más aguda; Martín, Elías, Acuña y Pereyra son voces
  de España bajadas de tono y con el seseo escrito en el texto para que no pronuncien la zeta), con variantes (voz en off,
  por teléfono, grito, del otro lado de una puerta) y normalización de volumen. Solo regenera lo que cambió. El reproductor
  las carga al apretar Reproducir, las programa en WebAudio junto con los efectos (el ambiente baja mientras alguien
  habla) y las muestra como subtítulos; la casilla «Voces» las apaga (quedan los subtítulos). El render del `.mp4` las
  decodifica igual. Además del diálogo hay narración en off de Verónica (frases de la novela en primera persona), que
  salieron de la versión con `speechSynthesis` que Nico armó en la sesión del 24/10.
- `src/`: la fuente. `comun.glsl` es la librería (ruido, primitivas, el rig de persona por postura y aspecto con cinemática
  inversa, posturas de pie, sentada, en silla y remando y la mezcla entre posturas, los aspectos de los seis personajes, la
  chata, la lancha colectiva, el semirrígido, la casa de dos plantas por fuera y por dentro, la cocina de arriba, el perro,
  los sauces, la firma de Verónica como curva, el cielo con tres regímenes, el agua, la iluminación y los materiales), `main.glsl` el `main()` común, `escenas/NN-*.glsl` una escena por archivo (cada una define el mundo, la
  cámara, el clima, el nivel del agua y las luces), `sonido.js` la síntesis y `reproductor.js` la línea de tiempo y el
  reproductor. `node build.js` arma `index.html` con todo adentro.
- `render.js`: renderiza a 1280×720 y 30 fps con Chromium headless (WebGL por software) y ffmpeg, **de a una escena**
  (`node render.js escena 8`), a `video/escena-NN.mp4`; `node render.js armar` concatena los segmentos que haya desde
  la escena 0 y les pega el audio renderizado con `OfflineAudioContext`. Por software un cuadro a 1280 px tarda de 30 a
  90 s según la escena (y a 640 px, de 3 a 6 s), así que los segmentos se hacen primero en **borrador a 640×360 escalado
  a 1280×720** (`node render.js escena 8 3 640`) y se van reemplazando por la versión a resolución completa noche a noche.
  `video/RESOLUCION.txt` dice cómo está renderizado cada uno; `armar` verifica que cada segmento dure lo que dura su
  escena. `sudestada-el-corto.mp4` es, por ahora, el borrador de la primera noche (nueve escenas, 203 s, sin voces): se
  reemplaza cuando las escenas del guion nuevo estén renderizadas.
- `tests/corto.e2e.js`: Playwright a 360 y 1280 px: compilan los shaders de todas las escenas, cada escena con shader propio
  tiene imagen, Reproducir arranca, saltar desde la lista cambia de escena, sin scroll horizontal ni errores en consola.
  `tests/ver.js` renderiza uno o varios cuadros de una escena a PNG (`ver.js 18 3,18,46.5`), para mirarlos mientras se
  trabaja; conviene pedir varios por proceso, porque SwiftShader compila el shader a nativo la primera vez que lo dibuja
  (50 a 110 s) y después cada cuadro cuesta solo el dibujo.

## Cómo está hecho

- **Personas:** un rig único (`persona(q, Pose, Aspecto)`): la postura son las articulaciones (cadera, pecho, hombros,
  codos, manos, rodillas, pies, hacia dónde se cierran los dedos, giro e inclinación de la cabeza) y el aspecto dice si es
  mujer u hombre, barba, pelo (corto, recogido o suelto y mojado, con volumen), gorra o sombrero, panza y ropa. La cabeza
  es la de Diez segundos (cráneo, mandíbula, pómulos, nariz, cuencas, cejas, orejas, labios) con ojos pintados (almendra,
  iris, pupila, pestañas) y proporciones distintas para Verónica y Ana. Las manos tienen palma, tres dedos y pulgar que se
  cierran sobre lo que agarran. Hay posturas base (de pie o caminando, sentada, remando) que cada escena ajusta, y
  **cinemática inversa de dos huesos** (`resolver(Pose)`): la escena pide dónde va cada mano y cada pie, y el rig ubica
  codos y rodillas a los largos reales del brazo y la pierna; si algo queda fuera del alcance, la mano se acerca en vez de
  estirarse. En la escalera, Verónica pisa los escalones reales (cada pie planta en un escalón y pasa por el aire al
  siguiente, por encima de la nariz del escalón del medio) y la mano derecha va por el pasamanos.
- **Escenas:** el shader de cada una es `defines + comun + escena + main`; la escena define `mapaMundo`, `camara`,
  `clima` (luz, alba, nubes, lluvia, niebla, viento y corriente), `nivelAgua`, `luz(i)` (hasta cuatro luces puntuales
  con sombra suave) y `aguaExtra` (ondas de la estela, espuma y hojas). Los programas se compilan al reproducir, uno por
  escena, con la siguiente precompilada mientras corre la actual (`KHR_parallel_shader_compile` si está).
- **Sonido:** `sonidos()` es una caja de herramientas por escena: viento con ráfagas, lluvia, truenos, el motor diésel de
  la lancha, oleaje, corriente, pasos en madera, chapas y vidrios que vibran, goteo con reverberación, madera que trabaja,
  el grupo electrógeno, la radio AM sin palabras, la remada (palada, arrastre, golpe de horquilla), el perro, el vuelco,
  la puerta corrediza de chapa, pájaros, y un piano sintetizado para el motivo de cinco notas en Re menor que vuelve en
  tres escenas y resuelve en Re mayor al final; para las escenas nuevas, el mate, el cajón, el papel, el cuchillo, la llave,
  la puerta, la leña, el balde, el ventilador de techo y la lapicera. Todo pasa por un bus de ambiente (que baja a la mitad
  mientras alguien habla), un compresor suave y un limitador. Saltar en la barra reprograma el sonido desde ese segundo.

## Cómo se prueba

```
cd experimentos/sudestada-el-corto && node build.js                                       # arma index.html desde src/
NODE_PATH=/opt/node-tools/node_modules node experimentos/sudestada-el-corto/tests/corto.e2e.js
NODE_PATH=/opt/node-tools/node_modules node experimentos/sudestada-el-corto/tests/ver.js 18 3,46.5 /tmp/cuadro.png   # cuadros
NODE_PATH=/opt/node-tools/node_modules node experimentos/sudestada-el-corto/render.js escena 1       # un segmento del .mp4
NODE_PATH=/opt/node-tools/node_modules node experimentos/sudestada-el-corto/render.js armar          # el .mp4 con audio
```

## Qué no se pudo probar

- El rendimiento en una GPU real: en la nube se renderiza por software. Las escenas con personas cerca de cámara (la 2, la
  15) son pesadas y los interiores con sombras (la escribanía, la cocina de Elías, la escalera de adentro) son los más
  pesados de todos (habitación cerrada, cuatro personas, sombras: a 640 px un cuadro cuesta 20 a 35 s por software, tres o
  cuatro veces lo de las exteriores); la calidad automática baja la resolución hasta que fluya, y en un celular conviene
  aceptar que se vea en baja.
- Las escenas se controlaron cuadro por cuadro (`tests/ver.js`) en seis a nueve instantes cada una, no en movimiento: una
  mano que atraviesa algo entre dos instantes, o una transición brusca, se va a ver recién en el `.mp4` o reproduciendo en
  una compu con GPU.
- El sonido y las voces se verificaron solo como forma de onda (duración, tono medio, volumen normalizado) y con el
  `OfflineAudioContext`, sin parlantes: cómo suenan de verdad las voces de Piper en castellano (la tonada, el seseo
  escrito de las voces de España) y los niveles relativos necesitan una pasada con auriculares. Si una voz no convence, en
  `voces/generar.py` se cambia el modelo, el tono o la velocidad del personaje y se regeneran solo sus líneas.
- «Grabar y descargar» depende de MediaRecorder con canvas: anda en Chrome y Firefox de escritorio y en Android; en
  iPhone Safari puede no estar.
