# Dividir gastos

Quién le debe cuánto a quién después de un asado, un viaje o un regalo en grupo. Una PWA sin
servidor: se crea un evento, se cargan las personas y los gastos, y la app calcula el saldo de
cada uno y **la menor cantidad de transferencias** para quedar a mano. El resumen se copia como
texto listo para pegar en el grupo de WhatsApp.

**Estado:** terminado.
**Probar:** https://fnguerrero.github.io/working-folder-auto/apps/dividir-gastos/

Salió de la sugerencia https://github.com/fnguerrero/working-folder-auto/issues/3.

## Qué hace

- **Eventos**: varios a la vez («Asado del sábado», «Viaje a Córdoba»), cada uno con nombre y
  fecha, con el total y cuántas transferencias le quedan pendientes. Hay un ejemplo para ver
  cómo funciona sin cargar nada.
- **Personas**: nombre y, si querés, el alias o CBU, que sale en el resumen al lado de quien cobra.
  No deja repetir nombres ni sacar a alguien que aparece en un gasto.
- **Gastos**: en qué, cuánto, la fecha, quién pagó y entre quiénes se divide, de cuatro maneras:
  - **iguales**: se marca quiénes entran (el que no toma no paga las bebidas);
  - **partes**: 2 para una pareja, 0,5 para un chico, 0 si no entra;
  - **porcentaje**: tienen que sumar 100 % (al elegirlo se reparte parejo entre los que estaban
    marcados, y «Repartir parejo» lo vuelve a hacer);
  - **montos**: cuánto le toca a cada uno en pesos; «Completar con lo que falta» pone el resto.

  Mientras se carga, cada persona ve cuánto le toca y, si los porcentajes o montos no cierran,
  cuánto falta o sobra.
- **Cuentas**: el total, una tabla con cuánto puso cada uno, cuánto le tocaba y el saldo (verde
  le deben, rojo debe), y la lista mínima de transferencias. Cada una tiene «Ya la hizo», que la
  registra como pagada (con «Deshacer»); los saldos la tienen en cuenta.
- **Copiar resumen** (y **Compartir** en el celular): texto plano con pesos en formato es-AR y
  negritas de WhatsApp. Si el navegador no deja copiar, el texto queda a la vista para copiarlo
  a mano.
- **Exportar e importar** el evento en JSON, para pasarlo a otro celular o guardarlo. Si se
  importa uno que ya está, entra como copia.

En el celular las tres secciones van en solapas; en la compu, en tres columnas. Todo queda en
`localStorage`: no hay cuenta, ni red, ni publicidad.

## Cómo se calcula

- **Importes en centavos enteros**: ninguna cuenta pasa por flotantes.
- **Reparto de un gasto**: por el método del resto mayor. $1.000 entre tres es 333,34 + 333,33
  + 333,33: el centavo que sobra va al de mayor resto y, si empatan, al primero de la lista. Las
  partes siempre suman exactamente el gasto. Los porcentajes se guardan en centésimas (33,33 %
  es 3333) para que sumen 100 exacto.
- **Saldo** = lo que puso − lo que le tocaba + lo que ya transfirió − lo que ya recibió.
- **Mínimo de transferencias**: si las n personas con saldo se pueden partir en g grupos que
  suman cero cada uno, alcanza con n − g transferencias, y no se puede con menos (cada grupo de
  k personas necesita al menos k − 1). Entonces el problema es encontrar la mayor cantidad de
  grupos: con hasta 20 personas con saldo se recorren todos los subconjuntos (programación
  dinámica sobre máscaras de bits, unos milisegundos) y cada grupo se salda con el método
  goloso, el que más debe le paga al que más le deben. El goloso solo no alcanza: con
  +7.000, +5.000, −4.000, −3.000 y −5.000 hace 4 transferencias, y el exacto encuentra 3
  ({+7.000, −4.000, −3.000} y {+5.000, −5.000}). Con más de 20 personas con saldo se usa el
  goloso, que da n − 1 como mucho.
- **Redondeo a pesos** (se puede apagar): nadie transfiere centavos. Cada saldo se baja al peso
  y los pesos que faltan para que sumen cero van a los de mayor resto. Nadie pone ni recibe un
  peso o más de diferencia con la cuenta exacta, y la app dice cuánto es. Con $1.000 entre tres
  pagado por A, B y C le pasan $333 cada uno y A se come 66 centavos. Si dos personas tienen el
  mismo saldo, puede que una redondee para arriba y otra para abajo (hay que cerrar la suma);
  el desempate es por el orden de la lista.
- **Una persona que se suma después** no entra sola en los gastos que ya estaban (puede haber
  llegado al postre): la app avisa y se edita el gasto si le toca.

## Cómo se prueba

Lógica pura, sin navegador (17 tests, con casos hechos a mano y el mínimo exacto comparado
contra una búsqueda por fuerza bruta en 300 casos al azar):

```bash
node --test apps/dividir-gastos/tests/*.test.js
```

Recorrido completo en Chromium headless a 360 × 740 (táctil, con solapas) y a 1280 × 800 (tres
columnas): crear el evento, seis personas, gastos en los cuatro modos con sus errores, saldos,
las cinco transferencias, copiar el resumen y leerlo del portapapeles, marcar y deshacer una
transferencia, editar y borrar un gasto, redondeo a pesos y sin redondear, exportar, eliminar,
importar, recargar, el ejemplo, el botón atrás, sin scroll horizontal, botones de 44 px,
manifest, service worker, sin pedidos afuera ni errores de consola:

```bash
npm i -D playwright && npx playwright install chromium   # una sola vez
node apps/dividir-gastos/tests/e2e.js
```

No se probó en un celular real ni la hoja de «Compartir» (Chromium headless no la tiene).

## Archivos

```
index.html        interfaz y estilos, con el script de la app
logica.js         funciones puras (reparto, saldos, transferencias, resumen, JSON); en el navegador y en Node
sw.js             service worker mínimo para instalar y usar sin conexión
manifest.json     manifiesto de la PWA
icono.svg         ícono
tests/            logica.test.js (node --test) y e2e.js (Playwright)
```
