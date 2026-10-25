# Feriados y días hábiles

Los feriados nacionales de Argentina de 2024 a 2027 (inamovibles, trasladables con su fecha real, puentes y
Jueves Santo), cada uno con la ley, decreto o resolución que lo fija. Una calculadora de plazos con tres modos
(sumar hábiles, hábiles entre dos fechas, qué es un día) y la misma lista en JSON y en una clase C#
`CalendarioArgentino` para pegar en un proyecto. Todo pasa en el navegador.

**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/feriados-y-habiles/

**Estado:** terminado. Salió de la sugerencia https://github.com/fnguerrero/working-folder-auto/issues/8.

## Hasta cuándo está confirmado

Lista consultada el **25/10/2026**.

| Año | Estado | Normas |
|---|---|---|
| 2024 | confirmado | Ley 27.399; Decreto 106/2023 (1/4, 21/6 y 11/10, feriados con fines turísticos) |
| 2025 | confirmado | Ley 27.399; Decreto 1027/2024 (2/5, 15/8 y 21/11, días no laborables con fines turísticos); Decreto 614/2025 y Resolución 139/2025 de la Jefatura de Gabinete (el 12/10, domingo, pasó al viernes 10) |
| 2026 | confirmado | Ley 27.399; Resolución 164/2025 de la Jefatura de Gabinete (23/3, 10/7 y 7/12, días no laborables con fines turísticos, Boletín Oficial del 26/12/2025) |
| 2027 | a medias | Están los 16 feriados de la Ley 27.399 con los traslados del art. 6. **Faltan** los días no laborables con fines turísticos (todavía no salió la norma) y saber si el 20/11, que cae sábado, se mueve al viernes 19 o al lunes 22 (lo puede decidir la Jefatura de Gabinete por el Decreto 614/2025). La página y el C# lo marcan "a confirmar". |

Las fuentes de cada fecha y los links a las normas están al pie de la página. Para verificar las fechas se usaron
los textos de los decretos y resoluciones en argentina.gob.ar y el Boletín Oficial, a través del buscador (desde
la nube no se puede entrar directo a los sitios `.gob.ar`) y notas de prensa que los citan; las fechas que
salen de aplicar la ley sola (Pascua, Carnaval, art. 6) las controla un test.

## Qué hace

- **Calendario** de cada año con colores por tipo: inamovible, trasladable en su fecha real (y con borde
  punteado el día donde caía), puente, no laborable, fin de semana y hoy. Al tocar un día dice qué es, la
  norma, si se movió algo de ahí, el próximo hábil y el próximo feriado, con un botón para usarlo en la
  calculadora. Debajo, la lista del año con tipo, nota y fuente.
- **Sumar hábiles**: «10 hábiles después del 15/10/2026» da el 29/10. Se cuenta desde el día siguiente;
  negativo va para atrás; con 0 da el mismo día si es hábil o el próximo hábil. Muestra los días corridos y
  qué feriados se salteó en el camino, y marca en el calendario el inicio, el final y los saltos.
- **Hábiles entre dos fechas**: sin contar la de partida y contando la de llegada, así sumar y contar son
  inversas. Lista los feriados del medio y avisa si contó como hábil un puente o el Jueves Santo.
- **¿Qué es este día?**: «el 20/11/2026 es hábil; acá caía Soberanía Nacional, que se pasó al lunes 23».
- **Opciones**: si los puentes (días no laborables con fines turísticos) y el Jueves Santo cuentan como no
  hábiles. Por defecto los puentes sí (la administración pública no atiende) y el Jueves Santo no. Los puentes
  de 2024 fueron feriados, así que cuentan siempre. Se recuerdan en `localStorage`.
- **Avisos**: si la cuenta pasa por 2027 avisa que el año no está completo; fuera de 2024–2027 da error en
  vez de inventar.
- **C# y JSON** con botón de copiar y de bajar: [`csharp/CalendarioArgentino.cs`](csharp/CalendarioArgentino.cs)
  y [`feriados.json`](feriados.json).

## La clase C#

Un solo archivo sin paquetes, para .NET 6 o más nuevo (usa `DateOnly`):

```csharp
var cal = new CalendarioArgentino();                       // puentes no hábiles, Jueves Santo hábil
cal.EsHabil(new DateOnly(2026, 11, 20));                   // true: Soberanía se pasó al lunes 23
cal.SumarHabiles(new DateOnly(2026, 10, 15), 10);          // 2026-10-29
cal.HabilesEntre(new DateOnly(2026, 9, 30), new DateOnly(2026, 10, 31)); // 21
cal.ProximoHabil(new DateOnly(2026, 12, 5));               // 2026-12-09
CalendarioArgentino.QueEs(new DateOnly(2026, 3, 23));      // el puente, con su fuente
CalendarioArgentino.EsFeriado(new DateOnly(2026, 3, 23));  // false: es día no laborable, no feriado
new CalendarioArgentino(puentesNoHabiles: false, juevesSantoNoHabil: true);
```

Fuera de 2024–2027 tira `ArgumentOutOfRangeException`. Se compiló y se probó en la nube con el SDK de .NET 8
del archivo de Ubuntu (`apt-get install dotnet-sdk-8.0`): `csharp/Prueba/` es un programa de consola, sin
NuGet, con los mismos plazos calculados a mano que los tests de JavaScript (31 pruebas).

## Qué hay que actualizar cada diciembre

1. Cuando sale la norma de los puentes del año que viene, agregar el año a `DATOS` y `ANIOS` en `logica.js`
   con sus trasladables (y fijarse si la Jefatura de Gabinete movió alguno que caía en fin de semana), y subir
   `ULTIMO_ANIO`. Para 2027: completar los puentes y el 20/11 cuando se publiquen.
2. Cambiar `CONSULTADO` a la fecha del día.
3. Regenerar el C# y el JSON: `node herramientas/feriados-y-habiles/generar.js`.
4. Correr los tests (abajo). El test «la lista coincide con lo que da la ley» avisa si una fecha cargada a mano
   no cuadra con la Pascua o con el art. 6, salvo las excepciones de decreto que estén anotadas.

## Qué no incluye

Feriados provinciales y municipales, ferias judiciales, asuetos de cada organismo, días no laborables para
quienes profesan una religión (Pascua y Año Nuevo judíos, Iom Kipur, fiestas islámicas, 24 de abril para la
comunidad armenia) y feriados extraordinarios que se decreten después de la fecha de consulta.

## Cómo se prueba

Lógica pura, sin navegador (fechas y Pascua, regla del art. 6, la lista contra la ley, cantidades y fuentes por
año, 19 plazos sumados a mano, hábiles entre fechas con ida y vuelta, qué es un día, errores, y que el C# y el
JSON del repo estén al día):

```bash
node --test herramientas/feriados-y-habiles/tests/*.test.js
```

La clase C# (hace falta el SDK de .NET 6 u 8):

```bash
dotnet run --project herramientas/feriados-y-habiles/csharp/Prueba
```

Recorrido en Chromium headless a 360 px y 1280 px, con el reloj fijo en el 25/10/2026 (estado y próximo
feriado, los tres modos con plazos a mano, opciones, errores, calendario y lista por año, tocar un día, copiar y
bajar C# y JSON, recarga con lo guardado, controles de 40 px, modo oscuro, sin pedidos a otros dominios ni
errores de consola):

```bash
npm i -D playwright && npx playwright install chromium   # una sola vez
node herramientas/feriados-y-habiles/tests/e2e.js
```

## Archivos

```
index.html                    interfaz y el script de la página
logica.js                     la lista con fuentes, las cuentas de hábiles y los generadores de C# y JSON; anda en el navegador y en Node
generar.js                    regenera csharp/CalendarioArgentino.cs y feriados.json desde logica.js
feriados.json                 la lista en JSON
csharp/CalendarioArgentino.cs la clase para pegar
csharp/Prueba/                programa de consola que prueba la clase
tests/                        logica.test.js (node --test) y e2e.js (Playwright)
```
