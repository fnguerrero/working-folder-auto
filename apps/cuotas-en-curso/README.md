# Cuotas en curso

Lo que ya comprometiste en cuotas, mes a mes. Una PWA sin servidor para el celular que responde
cuatro preguntas: **cuánto cae este mes y en qué tarjeta**, **cómo se ve el año que viene**,
**cuándo se libera cada compra** y **cuánto vale en pesos de hoy lo que falta pagar**.

## Qué es

Se cargan las compras que ya hiciste en cuotas (qué, dónde, cuándo, total financiado, cantidad
de cuotas, mes de la primera, tarjeta) y la app arma el resto:

- **Este mes**: la suma de cuotas que caen en el resumen que viene, desglosada por tarjeta, contra
  un tope mensual opcional con barra y semáforo.
- **Próximos 12 meses**: un calendario de barras apiladas por tarjeta. Se toca un mes y se ve qué
  compras lo componen y cuáles pagan su última cuota.
- **Lo que falta pagar**: el saldo nominal y el saldo en pesos de hoy, con una inflación mensual
  estimada que se edita en Ajustes.
- **Compras**: cuotas pagadas y restantes, saldo, hasta cuándo; las terminadas quedan aparte.
- **Simular**: una compra hipotética sobre el calendario real, que avisa en qué meses se pasaría
  del tope. No se guarda.
- **Respaldo**: descarga e importación en JSON (agregar o reemplazar) y descarga de CSV con una
  fila por cuota, listo para abrir en una planilla.

Todo queda en `localStorage` del navegador. No hay cuenta, ni red, ni servidor.

## Por qué le puede servir a Nico

Multimarket responde "¿me conviene comprar esto en cuotas?" *antes* de comprar. Esto responde lo
que viene después: la pila de cuotas que ya están corriendo. En Argentina el problema no es cada
compra, es cuánto se junta en marzo, y eso hoy se lleva en la cabeza o en una planilla. Acá se
lleva en el celular, en un toque.

## Cómo se usa

1. Abrí `index.html` en el navegador. En el celular, desde un servidor cualquiera (por ejemplo
   `python -m http.server` en esta carpeta) y "Agregar a la pantalla de inicio" para instalarla.
2. En **Compras**, tocá **Agregar compra**. El total es lo que suman todas las cuotas. Si dejás la
   primera cuota vacía, se asume el mes siguiente a la compra.
3. En **Ajustes**, poné un tope mensual si querés que te avise cuando te pasás, y la inflación
   mensual que esperás (por defecto 3 %).
4. En **Resumen** mirá el mes, el calendario y lo que falta en pesos de hoy.
5. Antes de comprar algo más, probalo en **Simular**.
6. Cada tanto, descargá el JSON desde Ajustes. Para pasar los datos a otro dispositivo, importalo
   allá con **Reemplazar todo**.

## Cómo se calcula

- Las cuotas son iguales: total dividido cantidad, redondeado al centavo; la diferencia va a la
  última cuota.
- La cuota del mes en curso cuenta como pendiente hasta que termina el mes. No se modela el
  cierre de la tarjeta: si tu cierre es a principio de mes, cargá la primera cuota un mes después.
- Pesos de hoy: una cuota dentro de `k` meses con inflación mensual `i` vale hoy
  `cuota / (1 + i)^k`. Con `i = 0` el saldo presente coincide con el nominal.
- Los importes se manejan en centavos enteros, y los meses como un índice entero
  (`año * 12 + mes`), para no depender de `Date` ni del huso horario.

## Cómo se prueba

Lógica pura, sin navegador:

```bash
node --test apps/cuotas-en-curso/tests/*.test.js
```

Recorrido completo en Chromium headless a 360 px (alta, resumen, calendario, tope, inflación,
simulador, descargas, recarga, borrado, importación, botones de 44 px, manifest y service worker):

```bash
npm i -D playwright && npx playwright install chromium   # una sola vez
node apps/cuotas-en-curso/tests/e2e.js
```

## Archivos

```
index.html        interfaz y estilos, con el script de la app
logica.js         funciones puras (cálculo, estado, JSON, CSV); se carga en el navegador y en Node
sw.js             service worker mínimo para instalar y usar sin conexión
manifest.json     manifiesto de la PWA
icono.svg         ícono
tests/            logica.test.js (node --test) y e2e.js (Playwright)
```
