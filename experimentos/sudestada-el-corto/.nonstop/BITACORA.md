# Bitácora del proyecto

## 2026-10-25 (noche 3)

- Sin comentarios nuevos de Nico en #15. Se siguió el orden del checklist: primero bajar el costo por cuadro, después las escenas.
- Costo por cuadro: la normal pasó de seis a cuatro evaluaciones del mapa (tetraedro), y el reflejo en el agua, que marchaba la
  escena entera con oclusión y sombras, ahora usa la mitad de los pasos y sombrea sin oclusión ni sombras (`sombrearX(…, rapido)`).
  Medido a 640 px: escena 1 de 5,5 a 4,3 s por cuadro (−22 %), escena 2 de 7,1 a 6,0 (−15 %). Comparadas las imágenes antes y
  después: iguales a simple vista. De paso: las estrellas se veían de día (puntitos en el cielo gris de las escenas 1 y 3).
- Escena 3: la coreografía de Elías (atar, subir, caminar, sentarse, levantarse, mirar el cielo) salió en tres pasadas. Lo que
  falló primero: las cámaras apuntaban al pecho (las cabezas quedaban fuera de cuadro: la cabeza de una persona de pie está a
  1,2 + 1,67 × escala), el `pelo` 4 (canoso) caía en la rama del pelo largo (`A.pelo > 2.5`) y Elías tenía melena gris, y el
  pulóver con mucho ruido en la normal parecía piel de oso. Todos de pie eran un enterito de un solo material: ahora el
  pantalón es oscuro de la cadera para abajo para todos, y el impermeable de Ana baja hasta medio muslo.
- Escena 6: el papel sobre el mesón estaba hundido en la tapa (la tapa llega a 0,93 y el papel estaba en 0,922: se veía una
  tira blanca) y después salió girado y espejado: la cámara desde el lado de la pared lo leía al revés. Quedó desde los ojos de
  ella (cámara 13 cm delante de la cara, mirando abajo) con el papel derecho y las firmas en el medio del cuadro, por encima
  del subtítulo. La derecha de alguien que mira a +x es +z (producto vectorial); el rig llama «D» al lado +z local, que para ese
  giro cae en −z del mundo: no importa para la imagen, pero conviene no razonar «derecha» desde el rig.
- Escenas 9 y 11: la cocina de arriba es un set aparte (no el primer piso de `casa()`, que es una caja hueca sin nada adentro),
  con el piso en y = 0 y el agua 90 cm más abajo para que por las ventanas se vea la crecida. Lo que falló: el boleto doblado
  aparecía sobre la mesa desde el primer cuadro (ahora está en el forro hasta que lo saca), las gotas del vidrio se dibujaban
  sobre la pared de enfrente (`GOTAS_VIDRIO` es la distancia a partir de la cual el rayo «pasó por la ventana»: con 3 m
  tomaba la pared del fondo; va 6), la toalla al cuello de Ana eran dos tubos de 9 cm que parecían orejeras (ahora es una banda
  chata por la nuca con dos puntas que cuelgan), la pantalla del celular quedó cabeza abajo (el extremo lejos de la mano es el
  de arriba) y el contraplano de Verónica «desde la puerta» la mostraba de nuca: la puerta está detrás de ella.
- Escena 10: el semirrígido a escala real (4,6 m) parecía una lancha de Prefectura al lado de la casa; quedó de 3,9. La cámara
  desde el agua tenía que ir a 10 m para que entraran la casa, el muelle hundido y el semirrígido.
- Escenas 12 y 14: el primer piso de la casa no existía como interior (la 7 solo tenía la escalera y el entrepiso con un hueco en
  el lugar equivocado: encima del tramo de abajo no había hueco y la cámara desde arriba veía piso). Ahora `interiorCasa()` tiene
  el hueco donde van los escalones, barandas, el rellano del oeste con su ventana y la pieza de Martín con la puerta que gira.
  Con `luz` 0 en el clima la vela sola no alcanzaba (todo negro salvo el halo): `luz` 0,08 da el ambiente mínimo de una casa de
  noche, y la vela pasó de 1,9 a 4,2 de intensidad. El piso de arriba estaba 6 cm por encima del último escalón (se veía un
  borde): el entrepiso bajó a 3,66-3,72. Y la cámara del final apuntaba a la pared al lado de la puerta: hay que calcular por dónde
  pasa el rayo central en el plano del tabique antes de dar por buena una cámara que mira «a través» de un vano.
- Escena 16: los cuatro estaban sentados de espaldas a la mesa (la regla «para mirar a φ el marco gira φ + π» hay que aplicarla
  también al respaldo de la silla: `silla()` tiene el respaldo en +x local, el lado contrario a donde mira la persona, así que va
  con el mismo giro que la persona, no con π más). Martín tenía el sombrero del remero de Diez segundos: ahora hay
  `aspectoMartinSinGorra`. La boca de la cocina a leña como única luz dejaba a Martín a oscuras: su farol, todavía prendido sobre
  la mesa, es la tercera luz y le ilumina la cara desde abajo.
- Escena 19: salió a la primera; la garza en el poste es tres elipsoides y una cápsula.
- Render: con `tests/ver.js` y el e2e corriendo a la vez, el render de fondo baja de 4-5 s por cuadro a 15-17: SwiftShader usa
  todos los núcleos y se pisan. Se renderiza en una copia del proyecto para que los cambios de la noche no lo rompan. Para
  que el e2e final corriera solo, pausé el render con `SIGSTOP` 20 minutos: la captura de cada cuadro tiene un tope de 10
  (`screenshot timeout`) y al reanudar el proceso murió; como `render.js cuadros` saltea los cuadros que ya existen, con
  relanzarlo retomó desde el 648 sin perder nada. Lección: pausar menos de 10 minutos o subir el tope antes de pausar. El
  e2e solo tarda 20 min (los interiores de la noche 3 son pesados a 1280 px). La escena 1 en borrador quedó en 22 min y la 2 en 90 (7,5 s por cuadro contra 1,5: la persona cerca de cámara y la sombra de la casa).

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
- A las 03.19 Nico, en la sesión, pusheó una versión con las voces del propio navegador (`speechSynthesis`, con narración en primera
  persona) y un arreglo del marco en pantallas bajas; chocó con esta noche al pushear. Se rebasó quedándose con las voces de Piper
  (suenan igual en todos lados y entran en el `.mp4`) y se tomaron de la suya la casilla «Voces» y las líneas de narración, que ahora
  también dice daniela. Son 109 líneas, 4,5 minutos de voz, 1,5 MB.
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
