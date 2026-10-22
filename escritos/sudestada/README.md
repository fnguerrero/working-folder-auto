# Sudestada

Novela corta de suspenso psicológico, en castellano rioplatense, ambientada en una isla del Delta del Tigre durante
cuatro días de sudestada. Verónica Aldao, perita calígrafa, vive de decir si una firma es de quien dice ser. Su hermano
menor, Martín, la llama un martes a la noche: «Necesito que vengas. No por teléfono». Cuando llega el jueves, la lancha
de Martín no está, la puerta está abierta y en la cocina hay una mujer que dice ser su pareja. Esa noche entra el agua.

**Leer:** https://fnguerrero.github.io/working-folder-auto/escritos/sudestada/

**Estado:** terminada (pedido #14). Dieciocho capítulos, 35.600 palabras, escrita en una sola noche; la pasada de continuidad está en `.nonstop/CONTINUIDAD.md`.

## Qué hay

- `index.html`: el lector por capítulos. Índice con sinopsis, anterior y siguiente, flechas del teclado, recuerda en qué
  capítulo y a qué altura quedaste (localStorage), tema claro/oscuro (sigue al sistema, y un botón para forzarlo), tamaño
  de letra. Sin dependencias, anda abierto en local.
- `sudestada.html`: la novela entera en una sola página, con saltos de página para imprimir.
- `sudestada.epub`: la novela en EPUB 3.
- `capitulos/NN.md`: los capítulos, en Markdown mínimo. Son la fuente de todo lo demás.
- `build.js` genera `index.html` y `sudestada.html`; `epub.py` (Python, solo stdlib) arma el `.epub`.
- `.nonstop/`: la cocina. `SPEC.md` (objetivo, lugar y época argumentados, voz, estructura del giro, supuestos),
  `PERSONAJES.md` (qué quiere, qué esconde y qué sabe cada uno en cada momento), `ESCALETA.md` (capítulo por capítulo),
  `PISTAS.md` y `pistas.json` (las pistas del giro y en qué capítulo se siembra y se resuelve cada una), `CONTINUIDAD.md`
  (calendario interno, objetos que tienen que coincidir, quién sabe qué en cada capítulo y lo que se corrigió), `CHECKLIST.md`
  y `BITACORA.md`. **Ojo: tienen spoilers.** Si vas a leer la novela, no entres ahí.

## Cómo se prueba

```
cd escritos/sudestada
node build.js && python3 epub.py --check          # regenera lector, imprimible y EPUB, y valida la estructura del EPUB
node tests/palabras.test.js [--estricto]          # palabras por capítulo y total (estricto: 18 capítulos, 35.000-45.000)
node tests/pistas.test.js [--estricto]            # cada pista aparece en el capítulo que indica la escaleta
cd ../.. && NODE_PATH=/opt/node-tools/node_modules node escritos/sudestada/tests/lector.e2e.js   # Chromium a 360 y 1280 px
```

## Qué no se pudo probar

- El EPUB se validó estructuralmente (orden del zip, mimetype, XML bien formado, manifiesto completo), no con un lector
  de e-books real ni con epubcheck. Debería abrir en cualquier lector; si alguno se queja, avisar en el issue #14.
