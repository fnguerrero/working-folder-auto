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
- [~] Render de los segmentos que se pueda esta noche: la portada quedó en `video/escena-00.mp4`; las demás se lanzaron en cadena (1, 9, 5, 2, 3) y las que terminen antes del corte quedan commiteadas.
- [x] README, `proyectos.json` (en curso), tabla del README raíz, `noche-en-curso` en el issue, comentario de avance.

## Noches siguientes
- [ ] Pulir lo que quedó flojo a primera vista: la lancha colectiva (más casco visible, parantes entre ventanas, cabina más baja), la escena 4 (la lámpara domina el cuadro; que se vea más el agua subiendo y la mesa por la puerta), la 6 (el tronco y el remo perdido casi no se ven), caras (los ojos de Verónica todavía grandes de frente), y la bolsa de Verónica, que es una caja.
- [ ] Escuchar la banda de sonido entera (niveles relativos entre escenas, el motivo del piano) y ajustar.
- [ ] Renderizar los segmentos que falten (`node render.js escena N`), `armar` y revisar el `.mp4` cuadro por cuadro en los cortes.
- [ ] Terminar las escenas que falten y renderizar sus segmentos.
- [ ] Mejoras del motor: desenfoque de profundidad y motion blur solo en el render, texturas de madera y ropa más finas, espuma más física contra el bote.
- [ ] `.mp4` final armado, 2 a 4 minutos, con audio.
- [ ] Verificar contra los criterios del issue y pasar a `terminado`; cerrar #15.
