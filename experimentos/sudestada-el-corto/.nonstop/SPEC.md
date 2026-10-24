# Sudestada, el corto: spec

Pedido #15 (`noche`, `grande`): https://github.com/fnguerrero/working-folder-auto/issues/15

## Objetivo

(Primera versión, 23/10.) Un corto animado de 2 a 4 minutos, con sonido, que adapte imágenes y momentos de la novela
[Sudestada](../../../escritos/sudestada/) con el motor que quedó armado en [Diez segundos](../../diez-segundos/):
WebGL puro, un fragment shader por escena con raymarching para lo que tiene volumen, sonido sintetizado con WebAudio y
render a `.mp4`. Lo que más le importa a Nico: que se vea lo más real posible dentro de lo que da el método (una
animación 3D bien iluminada) y que las personas no parezcan muñecos geométricos.

## Segunda versión (24/10): lo que pidió Nico al ver el borrador

1. Que dure **unos diez minutos**. 2. **Mejor sonido.** 3. **Diálogos con voz** que suenen más o menos realistas (importantísimo).
4. **Mucha mejor calidad de imagen y de movimiento** (en la escalera el muñeco se distorsionaba, la mano se estiraba y atravesaba
la geometría). 5. **Un final con cierre y una moraleja.**

Decisiones:
- El guion se rehace en veinte escenas (`GUION.md`) siguiendo la novela de cerca, con las frases de los personajes tal como
  están escritas, y termina donde termina la novela: en la escribanía, con las dos firmas juntas y la pregunta de Verónica.
  La moraleja es la de la novela, dicha por Verónica y escrita en el cierre: «Cuando los hechos dicen lo que una ya pensaba, es
  cuando menos hay que creerles», y «Preguntá. Y después, esperá.»
- Las voces se sintetizan en la nube con Piper (`voces/generar.py`), una por personaje, y los `.ogg` van al repo: suenan igual
  en el navegador y en el `.mp4`. Hugging Face está bloqueado desde la nube; las mismas voces están reempaquetadas en el release
  `tts-models` de sherpa-onnx en GitHub, que sí se alcanza. Las voces se cargan al apretar Reproducir, se programan en WebAudio
  como un efecto más y se subtitulan.
- Movimiento: antes de sumar escenas se arregló el rig con cinemática inversa de dos huesos (largos de brazos y piernas acotados,
  nada se estira), los pies en los escalones reales y una caminata más lenta y con peso. Cada escena nueva se termina al nivel de
  Diez segundos antes de pasar a la siguiente, una o dos por noche.
- Orden de las noches: (a) rig y movimiento, (b) voces, (c) guion largo con final, (d) sonido, (e) render.
- Las escenas del guion nuevo que todavía no tienen shader se reproducen igual, sobre el shader de la portada, con el diálogo y
  los subtítulos y una nota («escena todavía sin imagen»), para que la película se escuche entera mientras se hace.
- El `.mp4` sigue siendo el borrador de la primera noche hasta que las escenas nuevas estén renderizadas: `armar` verifica que cada
  segmento dure lo que dura su escena y no mezcla versiones.

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
  recodificar. Medido en la nube (SwiftShader): a 1280 px un cuadro tarda 30 a 90 s según la escena, a 960 px 12 a 23 s y a
  640 px 3 a 6 s (el costo crece más que lineal con los píxeles). Para que Nico tenga la película entera cuanto antes, los
  segmentos se renderizan primero **en borrador a 640×360 escalados a 1280×720** (`render.js escena N 3 640`), y después,
  noche a noche, se re-renderizan a resolución completa y reemplazan al borrador. `video/RESOLUCION.txt` dice cómo se
  renderizó cada uno; el criterio «1280×720» del issue se da por cumplido recién con todos los segmentos a resolución completa.
- El agua es siempre un plano horizontal (`nivelAgua(t)`), también adentro de la casa en la escena de la escalera.
- **Voces (24/10):** Verónica es `es_AR-daniela-high`, la única voz argentina de Piper. Ana es la misma voz un 8 % más aguda y
  más rápida (es de Zárate, la misma tonada; distinguirla por el timbre alcanza). No hay voces masculinas rioplatenses en Piper:
  Martín, Elías, Acuña y Pereyra usan voces de España (`davefx`, `sharvard`) con el tono bajado y el texto escrito con seseo para
  que no digan la zeta; la entonación sigue siendo peninsular, y si a Nico no le cierra, se cambia el modelo en `generar.py`.
  Los gritos no se pueden sintetizar de verdad: se hacen con más volumen, compresión y un poco más de tono.
- **Duración (24/10):** el guion suma 724 s; se recorta en el montaje a unos diez minutos cuando estén todas las escenas.
