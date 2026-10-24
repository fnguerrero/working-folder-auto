# Bitácora del proyecto

## 2026-10-24 (noche 2)

- Nico vio el borrador y pidió otra película: diez minutos, voces, mejor movimiento, mejor sonido y un final con moraleja. Se tomó
  en ese orden: primero el rig, después las voces, después el guion.
- Rig: lo que se estiraba en la escalera era que la escena pedía la mano en el pasamanos a 65 cm del hombro con un brazo de 55. Ahora
  `resolver(Pose)` aplica cinemática inversa de dos huesos a brazos y piernas (largos reales, articulación del lado de la pista) y
  `persona()` la llama siempre; las escenas que cuelgan cosas de las manos (la bolsa, el farol, los remos, la linterna) la llaman
  antes para que el objeto vaya donde quedó la mano. En la escalera, Verónica pisa los escalones reales: cada pie planta en un
  nivel y pasa por el aire al siguiente con un arco que supera la nariz del escalón del medio; la cadera baja 5 cm y sube con el
  empuje de la pierna de atrás (más tarde que el pie). Tropiezo: si el cuerpo sube linealmente con el pie, la pierna de atrás
  queda a 99 cm de la cadera y se estira; con el retraso y la cadera baja queda a 93 y la holgura del IK (0,5 %) levanta el talón.
- Voces: `pip install piper-tts` anda; las voces viven en Hugging Face, que está bloqueado, pero el release `tts-models` de
  sherpa-onnx (GitHub) las tiene reempaquetadas tal cual (`vits-piper-<voz>.tar.bz2`, con el `.onnx` y el `.json`), y GitHub sí
  se alcanza. Piper tiene una sola voz argentina (`es_AR-daniela-high`, mujer) y ninguna masculina rioplatense: los hombres salen de
  voces de España bajadas de tono, con el seseo escrito en el texto («hise», «ves», «onse») para que no digan la zeta; la entonación
  sigue siendo de allá. Medido el tono medio de cada voz (autocorrelación): daniela 185 Hz, davefx 142, sharvard 0 113, sharvard 1
  200, claude (es_MX) 197 (es mujer, no sirvió para Martín). `es_MX-ale` no está en ese release. 96 líneas, 2 a 4 s de síntesis por
  línea a 22 kHz, pasadas por ffmpeg (tono con `asetrate`+`atempo`, compresión, `loudnorm` a -19 LUFS, silencios recortados) a
  Opus 32 kb/s: 254 s de voz, 1,3 MB en total.
- Reproductor: las voces se cargan y decodifican al apretar Reproducir (seis a la vez, con contador), se programan como fuentes de
  WebAudio y el bus de ambiente baja al 45 % mientras hablan; subtítulos en texto chico sin cursiva (los intertítulos quedan para
  los carteles y el cierre). Cadena maestra con compresor y limitador. Los tiempos del guion son «no antes de»: si una línea
  arranca antes de que termine la anterior, se corre.
- Guion segunda versión: veinte escenas, 724 s, con las frases de la novela. Las nueve que existían se alargaron para el diálogo y
  se renumeraron; las once nuevas se escuchan sobre la portada con una nota, para que la película exista entera mientras se hace.
- Los segmentos viejos del `.mp4` se sacaron del árbol: no coinciden con el guion nuevo. El `.mp4` queda como borrador de la noche 1
  (dice el README) y `armar` ahora verifica que cada segmento dure lo que dura su escena.

## 2026-10-23 (noche 1)

- Spec, guion de nueve escenas (183 s) y checklist. Decisión: va en `experimentos/`, porque es ante todo el motor; la novela sigue en `escritos/`.
- Motor nuevo sobre la base de Diez segundos, reorganizado para varias escenas: `src/comun.glsl` (librería + rigs + escenografía + cielo + agua + luces + materiales), `src/main.glsl`, una escena por archivo en `src/escenas/`, `src/sonido.js`, `src/reproductor.js`; `build.js` arma `index.html`. Cada escena compila solo lo que usa, así que anda bastante más rápido que el shader único de Diez segundos (por software, un cuadro a 640 px tarda 2 a 6 s según la escena; a 1280 px, 4 a 20 s).
- El rig de persona pasó a ser `persona(q, Pose, Aspecto)`: postura por articulaciones y aspecto (mujer/hombre, barba, pelo con volumen en tres variantes, gorra o sombrero, panza, ropa). Hay posturas base de pie/caminando, sentada y remando. Se sumaron ojos pintados (almendra, iris, pupila, pestañas) y labios; la primera versión de los ojos, redonda y grande, daba cara de muñeco: la almendra fina lo arregló bastante. El pelo pintado plano parecía casco de natación; con hebras en la normal y el color ya parece pelo.
- Escenografía nueva: lancha colectiva (casco con arrufo y proa afinada, cabina con ventanas repetidas, timonera, mástil, defensas), casa de dos plantas hueca por dentro (galería, escalera al muelle, muelle, toalla con la tira de flores, mesa de la abuela, cocina con mesada), perro, farol a kerosene, orilla con sauces repetidos por celda (cada uno con su tamaño), sauces más grandes e irregulares.
- Las nueve escenas quedaron con shader propio. Los tropiezos de la noche, para no repetirlos: (1) la convención de giro: para que una persona mire al ángulo φ del mundo, el marco local se gira φ + π (`rot` es columna-mayor y me comí un signo: Verónica subía la escalera mirando a cámara); (2) las casas tienen que ser huecas (caja menos caja) o la puerta abierta muestra un nicho de 20 cm; lo mismo para los interiores: una caja negada deja sólido todo el exterior y las ventanas dan a una pared; (3) el entrepiso tapa la cámara si la cámara queda arriba del hueco de la escalera; (4) los halos de las luces no deben sumarse si hay geometría entre la cámara y la luz (en Diez segundos el farol siempre estaba a la vista); (5) la lámpara de pie a 40 cm de la cámara tapa medio cuadro.
- `render.js` por escena a `video/escena-NN.mp4` y `armar` con concat + audio de `OfflineAudioContext`. La portada (180 cuadros, con PASOS 40) tardó 12 min con 2 procesos compitiendo con los renders de prueba. Las escenas con personas cerca van a tardar bastante más: se renderizan en cadena y lo que termine antes del corte queda commiteado.
- E2e en verde a 360 y 1280 px (compilan las diez, imagen en las nueve propias, reproducir, saltar, sin scroll).
