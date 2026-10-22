# Checklist

## Antes de escribir
- [x] SPEC con objetivo, lugar y época argumentados, voz, estructura del giro, criterios y supuestos.
- [x] PERSONAJES: qué quiere, qué esconde, qué sabe en cada momento; tabla de conocimiento por momento.
- [x] ESCALETA capítulo por capítulo con siembra y resolución de pistas.
- [x] PISTAS.md y pistas.json (20 pistas) y releída de la escaleta contra las pistas.
- [x] `build.js` (Markdown mínimo → `index.html` lector, `sudestada.html` imprimible, carpeta EPUB), `epub.py`.
- [x] `tests/pistas.test.js`, `tests/palabras.test.js`, `tests/lector.e2e.js`.

## Capítulos
- [x] 1. La bolsa de siempre
- [x] 2. La tinta
- [x] 3. Lo que dice ella
- [x] 4. El agua sube por la escalera
- [x] 5. Firmé yo
- [x] 6. Pan como para tres
- [x] 7. Una mano que me conoce
- [x] 8. La planta baja
- [x] 9. La chata
- [x] 10. El pan
- [x] 11. El señor Acuña
- [x] 12. 14.10
- [x] 13. Con llave
- [x] 14. Ella
- [x] 15. El Negro
- [x] 16. La cocina de Elías
- [x] 17. Barro
- [x] 18. Martes, once

## Al terminar
- [x] Releída de la escaleta contra las pistas (`node tests/pistas.test.js` verde).
- [x] Conteo: entre 35.000 y 45.000 palabras (`node tests/palabras.test.js`).
- [x] Pasada de continuidad: `CONTINUIDAD.md` (nombres, fechas, quién sabe qué y cuándo), corregido lo que haga falta.
- [x] E2e del lector a 360 y 1280 px; EPUB abre (estructura validada con `epub.py --check`).
- [x] README del proyecto, `proyectos.json` (sinopsis sin spoilers), tabla del README raíz, estado `terminado`.
- [x] Comentario en el issue #14 con el link y cierre.
