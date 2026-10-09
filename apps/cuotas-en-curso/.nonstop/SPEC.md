# Cuotas en curso — especificación

Issue: fnguerrero/taller-nocturno#1 · Branch: `noche/1-cuotas-en-curso` · Carpeta: `cuotas-en-curso/`

## Objetivo

Una PWA sin servidor para llevar las compras en cuotas que ya se hicieron y responder, desde el
celular, cuatro preguntas: cuánto cae este mes y en qué tarjeta, cómo se ve el año que viene mes
a mes, cuándo se libera cada compra, y cuánto vale en pesos de hoy lo que falta pagar.

## Alcance

### Entra

- Alta, edición y baja de compras: descripción, tienda (opcional), fecha de compra, total
  financiado, cantidad de cuotas (1 a 72), mes de la primera cuota, tarjeta (texto libre con
  sugerencias de las ya usadas) y nota opcional.
- Cuotas iguales: `total / cuotas`, redondeadas al centavo; la última absorbe la diferencia.
- Resumen del mes en curso: total de cuotas que caen, desglose por tarjeta, comparación contra un
  tope mensual opcional con barra y semáforo.
- Calendario de los próximos 12 meses: barras apiladas por tarjeta; tocar un mes muestra qué
  compras lo componen y cuáles terminan ese mes.
- Lista de compras con cuotas pagadas / restantes y saldo pendiente; las terminadas quedan en una
  sección aparte, no se borran solas.
- "Pesos de hoy": inflación mensual estimada editable (por defecto 3 %); cada cuota futura se trae
  a valor presente con `cuota / (1 + i)^k`, con `k` los meses hasta esa cuota. Se muestra el saldo
  nominal y el saldo en pesos de hoy, por compra y total.
- Simulador: una compra hipotética que se dibuja sobre el calendario real y avisa en qué meses
  pasaría el tope. No se guarda.
- Exportar e importar JSON (reemplaza o agrega), exportar CSV de cuotas (mes, compra, tarjeta,
  número de cuota, importe).
- Ajustes: tope mensual, inflación mensual, borrar todo con confirmación.
- Instalable (manifest + service worker mínimo) y usable sin conexión.
- Lógica pura en `logica.js`, testeada con `node --test`. Prueba de extremo a extremo en Chromium
  headless con Playwright.

### Queda afuera

- Interés, CFT y comparación contado vs. cuotas (eso es Multimarket).
- Leer resúmenes, conectarse al banco, scrapear.
- Fechas de cierre y vencimiento por tarjeta: se trabaja a nivel de mes.
- Varias monedas, usuarios, backend, notificaciones.

## Criterios de terminado (verificables)

1. Cargar una compra de $120.000 en 6 cuotas con primera cuota en el mes actual muestra $20.000
   en "este mes" y la compra aparece en los 6 meses correctos del calendario.
2. Dos compras en tarjetas distintas se ven apiladas por tarjeta en el calendario y desglosadas en
   el resumen del mes.
3. Con tope $100.000 y cuotas por $120.000 en un mes, ese mes se marca en rojo y el resumen lo dice.
4. Con inflación 0 % el saldo en pesos de hoy es igual al nominal; con 3 % es menor y una cuota a
   12 meses vale `cuota / 1.03^12`.
5. El simulador no modifica los datos guardados y muestra el mes en que se pasaría el tope.
6. Exportar JSON, borrar todo e importar deja los mismos datos. El CSV abre en una planilla con una
   fila por cuota.
7. Recargar la página conserva todo (localStorage) y, si `localStorage` falla, la app sigue
   funcionando en memoria y lo avisa.
8. `node --test cuotas-en-curso/tests/*.test.js` pasa y la prueba headless en Playwright recorre alta,
   resumen, calendario, simulador y export.
9. En un viewport de 360 px no hay scroll horizontal y los botones miden al menos 44 px.
10. README del proyecto y fila en la tabla del README de la raíz.

## Decisiones técnicas

- Tres archivos de app: `index.html` (UI y estilos), `logica.js` (funciones puras, sin DOM,
  cargable desde Node), `sw.js` + `manifest.json` para instalar. Sin dependencias ni CDNs.
- Estado único `{v, ajustes, compras}` en `localStorage` bajo la clave `cuotas-en-curso.v1`,
  siempre dentro de try/catch. La versión permite migrar más adelante.
- Los meses se representan como `"AAAA-MM"` y se operan con un índice entero `año * 12 + mes`
  para evitar los problemas de `Date` con husos horarios.
- Importes en centavos enteros internamente; formato `es-AR` al mostrar.
- Los gráficos son SVG inline generados con strings, sin librerías.
- Tarjetas: texto libre normalizado (sin espacios extra), color asignado por orden de aparición
  desde una paleta fija de 6 colores.

## Supuestos

- "Mes en curso" es el mes calendario de hoy: no se modela el cierre de la tarjeta. Quien quiera
  ajustar puede poner la primera cuota un mes más adelante.
- La primera cuota por defecto es el mes siguiente al de la compra, que es lo habitual en
  Argentina, pero se puede cambiar.
- La inflación por defecto es 3 % mensual, un valor redondo y fácil de reconocer como estimación;
  está pensada para que Nico la cambie.
- Las cuotas son iguales. Si una compra tiene cuotas desiguales, se carga el total financiado y la
  diferencia por redondeo va a la última cuota.
- Los textos y el formato de pesos son los de Argentina; no hay selector de idioma ni moneda.
