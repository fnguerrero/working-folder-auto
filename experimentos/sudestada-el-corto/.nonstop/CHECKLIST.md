# Checklist

## Noche 1 (2026-10-23)
- [x] SPEC.md, GUION.md, CHECKLIST.md.
- [ ] Esqueleto: `index.html` con reproductor (portada, barra de tiempo con salto, lista de escenas, calidad automática, grabar, intertítulos), armado de shaders `cabecera + comun + escena + main`, compilación perezosa.
- [ ] `comun`: librería (ruido, SDF), rig de persona por postura y aspecto, casa/muelle/sauces, cielo con tres regímenes, agua con nivel variable y espuma, lluvia, luces puntuales, materiales.
- [ ] Sonido común: viento, lluvia, truenos, motor, remada, goteo, madera, perro, chapa, pájaros, motivo musical; `programar(ctx, maestro, T0, desde)`.
- [ ] Escena 0, portada.
- [ ] Escena 1, la lancha colectiva.
- [ ] Escena 2, la puerta abierta (Verónica sube).
- [ ] Escena 3, el viento gira (Ana a contraluz).
- [ ] Escena 4, el agua sube por la escalera.
- [ ] Escena 5, el hombre de la chata.
- [ ] Escena 6, la chata.
- [ ] Escena 7, la luz en el galpón.
- [ ] Escena 8, salí del agua (Martín con el farol).
- [ ] Escena 9, barro y título.
- [ ] `render.js`: por escena a `video/escena-NN.mp4`, `armar` concatena y pega el audio.
- [ ] `tests/corto.e2e.js` a 360 y 1280 px; `tests/ver.js` para mirar cuadros.
- [ ] Render de los segmentos que se pueda esta noche.
- [ ] README, `proyectos.json` (en curso), tabla del README raíz, `noche-en-curso` en el issue, comentario de avance.

## Noches siguientes
- [ ] Terminar las escenas que falten y renderizar sus segmentos.
- [ ] Mejoras del motor: desenfoque de profundidad y motion blur solo en el render, texturas de madera y ropa más finas, espuma más física contra el bote.
- [ ] `.mp4` final armado, 2 a 4 minutos, con audio.
- [ ] Verificar contra los criterios del issue y pasar a `terminado`; cerrar #15.
