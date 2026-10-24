# Checklist

## Noche 1 (2026-10-23)
- [x] SPEC.md, GUION.md, CHECKLIST.md.
- [x] Esqueleto: `index.html` con reproductor (portada, barra de tiempo con salto, lista de escenas, calidad automática, grabar, intertítulos), armado de shaders `cabecera + comun + escena + main`, compilación perezosa.
- [x] `comun`: librería (ruido, SDF), rig de persona por postura y aspecto, casa/muelle/sauces, cielo con tres regímenes, agua con nivel variable y espuma, lluvia, luces puntuales, materiales.
- [x] Sonido común: viento, lluvia, truenos, motor, remada, goteo, madera, perro, chapa, pájaros, motivo musical; `programar(ctx, maestro, T0, desde)`.
- [x] Escena 0, portada.
- [x] Escena 1, la lancha colectiva.
- [x] Escena 2, la puerta abierta (Verónica sube).
- [x] Escena 3, el viento gira (Ana a contraluz).
- [x] Escena 4, el agua sube por la escalera.
- [x] Escena 5, el hombre de la chata.
- [x] Escena 6, la chata.
- [x] Escena 7, la luz en el galpón.
- [x] Escena 8, salí del agua (Martín con el farol).
- [x] Escena 9, barro y título.
- [x] `render.js`: por escena a `video/escena-NN.mp4`, `armar` concatena y pega el audio.
- [x] `tests/corto.e2e.js` a 360 y 1280 px; `tests/ver.js` para mirar cuadros.
- [x] Render de los segmentos (terminado el 24/10 a las 03:38 UTC: los diez segmentos en borrador a 640 px, salvo la portada a 1280, y `sudestada-el-corto.mp4` entero con audio, 203 s, 29 MB): la portada quedó en `video/escena-00.mp4` a 1280 px; el resto se renderiza en cadena **en borrador a 640 px escalado** (un proceso: tres Chromium a la vez rinden peor que uno) y cada segmento que termina se commitea solo. Medido: ~11 s por cuadro a 640 px en la escena 1 (unas 2 h por escena de 22 s); a 1280 px, 30 a 90 s por cuadro.
- [x] README, `proyectos.json` (en curso), tabla del README raíz, `noche-en-curso` en el issue, comentario de avance.

## Noche 2 (2026-10-24): rig, voces y guion largo
- [x] **Dirección de Nico (24/10, en la sesión; ver el comentario en #15):** que dure ~10 minutos; mejor sonido; **diálogos con voz sintetizada realista** (importantísimo); mucha mejor calidad de imagen y de movimiento (la mano de Verónica se estira en la escalera y atraviesa la geometría); un final con cierre y moraleja. Orden: rig y movimiento, voces, guion largo con final, sonido, render. Anotado en `SPEC.md`.
- [x] Rig: cinemática inversa de dos huesos para brazos y piernas (`ik2`, `resolver`), largos acotados, codos y rodillas del lado correcto; `persona()` la aplica siempre y las escenas que cuelgan cosas de las manos la llaman antes.
- [x] Caminata con peso: paso más corto, cadera que baja al caminar y sube en cada apoyo, balanceo hacia el pie que apoya, hombros que contrarrotan.
- [x] Escena 2: Verónica sube los escalones reales (un pie plantado por escalón, el otro pasa por el aire por encima de la nariz del siguiente), la mano derecha en el pasamanos, 1,1 s por escalón; Ana se da vuelta con la taza cuando la oye.
- [x] Voces: Piper instalado en la nube (`pip install piper-tts`); las voces bajadas del release `tts-models` de sherpa-onnx (Hugging Face está bloqueado); `voces/generar.py` + `voces/lineas.json` → 96 `.ogg` (1,3 MB), una voz por personaje con variantes (off, teléfono, grito, tras la puerta), normalizadas.
- [x] Reproductor: carga las voces al apretar Reproducir, las programa en WebAudio con el resto, baja el ambiente mientras hablan, subtítulos; compresor y limitador en la cadena maestra; `__wav` (el audio del `.mp4`) también las incluye.
- [x] `GUION.md` segunda versión: veinte escenas, 724 s, diálogos de la novela, final en la escribanía y moraleja. Línea de tiempo nueva en `reproductor.js` (archivos de escena renumerados); las escenas sin shader se escuchan sobre la portada con una nota.
- [x] Escenas existentes alargadas para el diálogo (1, 2, 4, 5, 7, 8, 13, 15, 17) y el título movido al cierre.
- [x] Sonidos nuevos: mate, cajón, papel, cuchillo, llave, puerta, viento que entra, leña, balde, ventilador, lapicera, calle, motivo en Re mayor.
- [x] Los segmentos viejos del `.mp4` se sacaron del árbol (no coinciden con el guion nuevo); `armar` verifica duraciones. El `.mp4` queda como borrador de la primera noche hasta renderizar las escenas nuevas.
- [x] **Escena 18, «Martes, once»** (la final): la escribanía (cáscara con ventana al este y puerta, escritorio con vidrio y cajoneras, los dos papeles con el texto impreso, la carpeta, la lupa, el ventilador que gira, el cuadro del velero, cuatro sillas), Pereyra con anteojos de media luna, Acuña de celeste, Martín afeitado con camisa blanca, Verónica de saco; la firma «Verónica Beatriz Aldao» como curva paramétrica (la V, la cola que baja del renglón, «erónica» con lazos, el salto, «Aldao») que se dibuja en el papel con la pausa de los nueve años (y Martín la hace de corrido, con el arrastre), la lapicera en la mano que sigue la punta; once planos de cámara y la vereda con sol. Medido: 20 a 30 s por cuadro a 640 px (tres veces las otras escenas).
- [x] `tests/ver.js` acepta varios tiempos por proceso (el JIT de SwiftShader cuesta 50 a 110 s por proceso).
- [x] Bug en el celular que encontró el e2e a 360 px: con veinte botones de escena la página desborda y el cuadro (flex con `aspect-ratio`) se achicaba a cero y quedaba por encima del borde; `flex-shrink: 0`, `justify-content: safe center` y la portada sin párrafo en pantallas angostas.
- [x] Mientras corría la noche, Nico (en la sesión, 03.19) pusheó una versión con las voces del navegador (`speechSynthesis`): quedó reemplazada por las voces de Piper, y se conservaron la casilla «Voces» para apagarlas y sus trece líneas de narración en off de Verónica (más el lanchero), sintetizadas con Piper.
- [x] README, SPEC, bitácora; e2e a 360 y 1280 px; comentario en #15.

## Noches siguientes (en orden)
- [ ] Escuchar las voces con auriculares (Nico) y ajustar modelo, tono o velocidad por personaje en `generar.py`.
- [ ] Escena 3, «La tinta»: la galería con Elías en el banco, Ana en la puerta, Verónica de pie; la chata de Elías que llega y se va.
- [ ] Pulir la escribanía: la lapicera entre el pulgar y el índice (hoy asoma detrás del puño), la cara de Pereyra de frente, las mangas de las camisas, el vidrio del escritorio con reflejo, el árbol por la ventana, la vereda (los dos parecen muñecos parados: que Martín tenga las manos en los bolsillos de verdad y Verónica lo mire); y bajar su costo por cuadro (menos pasos de AO y sombra adentro).
- [ ] Escena 19, «Cierre»: fondo propio (el arroyo en calma al sol) en vez de la portada.
- [ ] Escena 6, «Una mano que me conoce»: el taller con el bote sobre caballetes y el cajón; el boleto en primer plano con la firma que se dibuja.
- [ ] Escena 9, «El pan», y 11, «14.10»: la cocina de arriba (un set nuevo: mesa, ventana con lluvia, las dos sentadas), plano y contraplano; el teléfono en primer plano.
- [ ] Escena 10, «El señor Acuña»: el semirrígido en el muelle hundido, Acuña de camisa celeste en la galería.
- [ ] Escena 12, «Con llave», y 14, «Ella»: la escalera de adentro y el pasillo con la vela; el papel con las fechas; la pieza vacía con la ventana abierta.
- [ ] Escena 16, «La cocina de Elías»: el interior del galpón con la cocina a leña, las mantas, el mate y el VHF; cuatro personas sentadas.
- [ ] Bajar el costo por cuadro antes de re-renderizar: el rayo reflejado en el agua marcha la escena entera con AO y sombras (hacerlo con menos pasos y sin AO ni sombra), la normal evalúa `mapaMundo` seis veces más la del material (reusar), y las escenas con dos luces con sombra duplican la marcha de sombras. Objetivo: 3 a 4 s por cuadro a 640 px y menos de 20 s a 1280.
- [ ] Renderizar los segmentos del guion nuevo en cadena (`render.js escena N 1 640`), `armar`, y recién después re-renderizar a resolución completa escena por escena. Tamaño del repo: `armar` recodifica a crf 27 y el `.mp4` se commitea una sola vez por noche, al final.
- [ ] Pulir lo que quedó flojo: la lancha colectiva (más casco visible, parantes entre ventanas, cabina más baja), la 7 (la lámpara domina el cuadro; que se vea más el agua y la mesa por la puerta), la 8 (el tronco y el remo perdido casi no se ven), caras (los ojos de Verónica todavía grandes de frente), y la bolsa de Verónica.
- [ ] Escuchar la banda de sonido entera (niveles entre escenas, el motivo del piano) y ajustar.
- [ ] Mejoras del motor: desenfoque de profundidad y motion blur solo en el render, texturas de madera y ropa más finas, espuma más física contra el bote.
- [ ] Montaje final a unos diez minutos, `.mp4` entero con voces, verificar contra los criterios del issue y la dirección de Nico, pasar a `terminado` y cerrar #15.
