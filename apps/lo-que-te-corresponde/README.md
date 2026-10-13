# Lo que te corresponde

Calculadora laboral argentina para empleados con sueldo mensual: **liquidación final** (despido sin
causa, renuncia, despido con causa o mutuo acuerdo), **aguinaldo** y **vacaciones**, según la Ley de
Contrato de Trabajo (20.744) con las reformas de la ley 27.742 de 2024. Cada concepto muestra la
fórmula con tus números y el artículo que lo sostiene, para comparar renglón por renglón con lo que
te liquidaron.

**Estado:** terminado.
**Probar:** https://fnguerrero.github.io/working-folder-auto/apps/lo-que-te-corresponde/

## Qué hace

- **Liquidación final.** Días trabajados del mes, SAC proporcional, vacaciones no gozadas con su SAC
  y, si es despido sin causa, indemnización por antigüedad (art. 245, con tope opcional del convenio
  y piso del 67 % del fallo Vizzoti), preaviso sustitutivo (15 días, 1 o 2 meses) con su SAC, e
  integración del mes de despido con su SAC. Detecta el período de prueba (6 meses por ley; se
  puede cambiar a 3, 8 o 12), el preaviso otorgado y el egreso a fin de mes. Separa remunerativo de
  no remunerativo, descuenta el 17 % de aportes sobre lo remunerativo y da un neto estimado.
  Botón para copiar el detalle como texto.
- **Aguinaldo.** La mitad del mejor sueldo del semestre, proporcional por días si entraste, te
  fuiste o tuviste licencia sin goce, con la fecha de pago (30/6 o 18/12).
- **Vacaciones.** Días por antigüedad al 31/12 (14/21/28/35) o uno cada 20 trabajados si fue menos
  de medio año, valor del día (sueldo / 25), plus vacacional, neto y la ventana para tomarlas.
- **Cómo se calcula.** Cada regla con su artículo, los criterios adoptados y las fuentes en InfoLeg.

Todo corre en el navegador. Lo último cargado queda en `localStorage` (dentro de try/catch); no se
manda nada a ningún lado.

## Por qué le puede servir a Nico

Cuando a alguien lo despiden, renuncia o cobra el aguinaldo, la pregunta es siempre la misma: "¿está
bien este número?". Las calculadoras que hay en internet dan un total sin mostrar la cuenta. Esta
muestra la fórmula con los números puestos y el artículo, y es honesta sobre lo que no calcula
(ganancias, convenios, indemnizaciones agravadas).

## Criterios y supuestos

- Aportes del trabajador: 11 % jubilación + 3 % PAMI + 3 % obra social = 17 %. Sin cuota sindical.
- Remunerativo (con aportes): días trabajados y SAC proporcional. Sin aportes: antigüedad, preaviso,
  integración, vacaciones no gozadas y los SAC sobre ellos.
- Mes de 30 días para prorratear sueldo; semestres y año con sus días reales (bisiestos incluidos).
  El egreso en el último día del mes paga el mes completo.
- Antigüedad: el día de egreso cuenta como trabajado. "Fracción mayor de tres meses" es estricta:
  3 meses justos no suman un año; 3 meses y 1 día sí.
- Preaviso: 15 días en período de prueba, 1 mes hasta 5 años justos, 2 meses por encima.
- Vacaciones no gozadas: días anuales × días trabajados del año / días del año, a sueldo / 25.
- Art. 153 (menos de medio año): los "días efectivamente trabajados" se aproximan con 5/7 de los
  corridos si no se cargan a mano.
- Base del art. 245: el "mejor sueldo del último año" si se carga, si no el sueldo actual. Sin SAC.
- No se calcula ganancias, ni el 50 % del art. 2 de la ley 25.323 (depende de que haya juicio), ni
  indemnizaciones agravadas (embarazo, matrimonio, tutela sindical), ni fondos de cese por convenio.

## Cómo se prueba

Lógica pura con casos calculados a mano (antigüedad, art. 245, preaviso, período de prueba, tope y
Vizzoti, SAC, vacaciones, parser de importes):

```bash
node --test apps/lo-que-te-corresponde/tests/*.test.js
```

Recorrido completo en Chromium headless a 360 px y 1280 px (despido, preaviso otorgado, renuncia,
período de prueba, tope, errores, copiar, recarga, aguinaldo, vacaciones, controles de 44 px, sin
errores de consola):

```bash
node apps/lo-que-te-corresponde/tests/e2e.js      # necesita playwright (NODE_PATH si está global)
```

## Qué no se pudo probar

Las reglas se tomaron del texto de la LCT y de la ley 27.742; no hay un recibo real de liquidación
contra el cual contrastar centavo a centavo, y los convenios colectivos pueden cambiar bases, topes
y porcentajes. Por eso el resultado se presenta como estimado.

## Archivos

```
index.html             interfaz, estilos y el script de la app
logica.js              funciones puras; se carga en el navegador y en Node
tests/logica.test.js   tests de la lógica
tests/e2e.js           recorrido en Chromium a 360 y 1280 px
```
