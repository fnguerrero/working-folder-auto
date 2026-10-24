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

## Noches siguientes
- [ ] **Dirección de Nico (24/10, en la sesión; ver el comentario en #15):** que dure ~10 minutos; mejor sonido; **diálogos con voz sintetizada realista** (importantísimo); mucha mejor calidad de imagen y de movimiento (la mano de Verónica se estira en la escalera y atraviesa la geometría); un final con cierre y moraleja. Orden: rig y movimiento, voces, guion largo con final, sonido, render.
- [ ] Voces: probar Piper (`pip install piper-tts` anda desde la nube; Hugging Face, donde están las voces, está bloqueado: buscar un espejo o una voz en otro lado). Plan B para el navegador: `speechSynthesis` con la mejor voz es-AR/es disponible.
- [ ] Tamaño del repo: cada `armar` commiteado suma decenas de MB a la historia (GitHub avisó a los 58 MB). De ahora en más `armar` recodifica a crf 27 y el `.mp4` se commitea **una sola vez por noche**, al final; los segmentos de `video/` se reemplazan solo cuando cambian de verdad.
- [ ] Bajar el costo por cuadro antes de re-renderizar a más resolución: el rayo reflejado en el agua marcha la escena entera con AO y sombras (hacerlo con menos pasos y sin AO ni sombra), la normal evalúa `mapaMundo` seis veces más la del material (reusar), y las escenas con dos luces con sombra duplican la marcha de sombras. Objetivo: 3 a 4 s por cuadro a 640 px y menos de 20 s a 1280.
- [ ] Seguir la cadena de segmentos (`render.js escena N 1 640`) hasta tener el borrador entero, `armar`, y recién después re-renderizar a resolución completa escena por escena.
- [ ] Pulir lo que quedó flojo a primera vista: la lancha colectiva (más casco visible, parantes entre ventanas, cabina más baja), la escena 4 (la lámpara domina el cuadro; que se vea más el agua subiendo y la mesa por la puerta), la 6 (el tronco y el remo perdido casi no se ven), caras (los ojos de Verónica todavía grandes de frente), y la bolsa de Verónica, que es una caja.
- [ ] Escuchar la banda de sonido entera (niveles relativos entre escenas, el motivo del piano) y ajustar.
- [ ] Renderizar los segmentos que falten (`node render.js escena N`), `armar` y revisar el `.mp4` cuadro por cuadro en los cortes.
- [ ] Terminar las escenas que falten y renderizar sus segmentos.
- [ ] Mejoras del motor: desenfoque de profundidad y motion blur solo en el render, texturas de madera y ropa más finas, espuma más física contra el bote.
- [ ] `.mp4` final armado, 2 a 4 minutos, con audio.
- [ ] Verificar contra los criterios del issue y pasar a `terminado`; cerrar #15.
