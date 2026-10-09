# Bitácora — Cuotas en curso

## 2026-10-08 (noche 1)

**Hecho.** Spec y checklist. `logica.js` con todo el cálculo (meses como entero, cuotas
iguales con redondeo a la última, resumen por tarjeta y tope, valor presente, simulador,
migración, JSON y CSV) y 11 tests en `node --test`. La interfaz completa en `index.html`:
pestañas, formulario con validación por campo, lista con progreso y terminadas aparte,
resumen del mes con semáforo, calendario SVG apilado por tarjeta con detalle al tocar,
pesos de hoy, simulador con rayado para la compra hipotética, ajustes, export/import JSON,
CSV y borrar todo con doble toque. Manifest, ícono SVG y service worker.

**Verificado.** `node --check` en los tres .js y el script inline; 11 tests de lógica en
verde; recorrido de punta a punta en Chromium headless a 360 px (alta, validación, resumen,
calendario, tope, inflación 0 y 3 %, simulador, export JSON y CSV, borrar, importar,
recarga, editar, eliminar): sin scroll horizontal, botones de 44 px, sin errores de consola.

**Decidido solo.** La interfaz vive en un solo archivo y la escribí de una vez, así que
quedaron marcados más de 8 ítems: separarla a propósito hubiera sido artificial. Sin
librerías de gráficos: el calendario es SVG armado con strings. Confirmaciones de borrado
con doble toque en vez de `confirm()`, que en el celular instalado se ve feo. El CSV sale
con `;` y coma decimal, que es lo que abre bien Excel en español. El tope y la inflación se
guardan con un botón explícito, no al vuelo, para que no se disparen cálculos a mitad de
tipeo.

**Sigue.** Ítem 12: dejar el script de Playwright dentro del repo (`tests/e2e.js`) con
instrucciones. Ítem 14: README del proyecto y fila en la tabla del README de la raíz. Si
Nico comenta algo en el PR, va primero.

## 2026-10-09 (noche 2)

**Hecho.** Ítem 12: `tests/e2e.js`, la prueba de extremo a extremo con Playwright, ahora vive en
el repo con un servidor estático propio (para que el service worker se registre) y cubre alta
con validación, resumen, calendario, tope, inflación 0 y 3 %, simulador, descargas JSON y CSV,
recarga, borrar todo, importar en modo reemplazar, editar, eliminar, 360 px sin scroll
horizontal, botones de 44 px, manifest y service worker. Ítem 14: README del proyecto y fila en
la tabla del README de la raíz. Checklist completo: 14/14.

**Verificado.** `node --test cuotas-en-curso/tests/*.test.js`: 11 en verde. `node
cuotas-en-curso/tests/e2e.js`: 11 pasos en verde, sin errores de consola. `node --check` en
`logica.js`, `sw.js`, `tests/*.js` y el script inline.

**Decidido solo.** Los botones "Editar" y "Eliminar" medían 36 px; la spec pide 44 para todos
los botones, así que los subí en vez de aflojar el criterio. Importar en modo "Agregar"
conserva los ajustes locales (tope e inflación) y solo suma compras; "Reemplazar todo" es el
modo de restaurar un respaldo completo, y así quedó documentado en el README y probado en la e2e.
La prueba e2e carga Playwright con `require("playwright")` y explica cómo instalarlo si falta,
sin agregar `package.json` al repo: sigue siendo una carpeta sin dependencias.

**Sigue.** Nada: el proyecto está terminado y el PR sale de borrador. Queda esperar la revisión.
