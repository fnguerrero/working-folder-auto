# Checklist

## Antes de escribir
- [x] SPEC con objetivo, lugar y época argumentados, voz, estructura del giro, criterios y supuestos.
- [x] PERSONAJES: qué quiere, qué esconde, qué sabe en cada momento; tabla de conocimiento por momento.
- [x] ESCALETA capítulo por capítulo con siembra y resolución de pistas.
- [x] PISTAS.md y pistas.json (20 pistas) y releída de la escaleta contra las pistas.
- [ ] `build.js` (Markdown mínimo → `index.html` lector, `sudestada.html` imprimible, carpeta EPUB), `epub.py`.
- [ ] `tests/pistas.test.js`, `tests/palabras.test.js`, `tests/lector.e2e.js`.

## Capítulos
- [ ] 1. La bolsa de siempre
- [ ] 2. La tinta
- [ ] 3. Lo que dice ella
- [ ] 4. El agua sube por la escalera
- [ ] 5. Firmé yo
- [ ] 6. Pan como para tres
- [ ] 7. Una mano que me conoce
- [ ] 8. La planta baja
- [ ] 9. La chata
- [ ] 10. El pan
- [ ] 11. El señor Acuña
- [ ] 12. 14.10
- [ ] 13. Con llave
- [ ] 14. Ella
- [ ] 15. El Negro
- [ ] 16. La cocina de Elías
- [ ] 17. Barro
- [ ] 18. Martes, once

## Al terminar
- [ ] Releída de la escaleta contra las pistas (`node tests/pistas.test.js` verde).
- [ ] Conteo: entre 35.000 y 45.000 palabras (`node tests/palabras.test.js`).
- [ ] Pasada de continuidad: `CONTINUIDAD.md` (nombres, fechas, quién sabe qué y cuándo), corregido lo que haga falta.
- [ ] E2e del lector a 360 y 1280 px; EPUB abre (estructura validada con `epub.py --check`).
- [ ] README del proyecto, `proyectos.json` (sinopsis sin spoilers), tabla del README raíz, estado `terminado`.
- [ ] Comentario en el issue #14 con el link y cierre.
