# Cron en criollo

Pegás una expresión cron y te dice en castellano cuándo corre, con las próximas diez ejecuciones en
hora argentina (o UTC, o la del navegador), un desglose campo por campo, los avisos de las trampas
típicas y el código para pegar en Hangfire, Quartz.NET o NCrontab. Entiende cron estándar (5 campos:
Linux, Hangfire, NCrontab) y Quartz.NET (6 o 7 campos: segundos, año, `?`, `L`, `W`, `#`). Todo pasa en
el navegador.

**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/cron-en-criollo/

**Estado:** terminado.

## Qué hace

- **Explica** la expresión en una frase ("Cada 15 minutos, de 8 a 18 hs, de lunes a viernes.",
  "A las 18:00, el último viernes del mes.") y en una tabla campo por campo.
- **Próximas ejecuciones**: las 10 siguientes desde ahora, con cuánto falta y cuánto hay entre una
  y otra, en la zona horaria elegida. Respeta cambios de horario (la hora de pared se mantiene).
- **Dialecto automático**: 5 campos es estándar, 6 o 7 es Quartz. Se puede forzar. En Quartz, el
  día de la semana empieza en 1 = domingo; en estándar, 0 = domingo. Con nombres (`MON`, `FRI`) da
  lo mismo.
- **Errores que ayudan**: cuántos campos tiene y cuántos esperaba, qué valor se va de rango, el
  rango al revés, `L`/`W`/`#`/`?` fuera de Quartz, y el clásico de Quartz "hace falta `?` en día del
  mes o día de la semana", con un botón que lo arregla.
- **Avisos**: `*/7` no es "cada 7 minutos", el día 31 no existe en todos los meses, en estándar dos
  restricciones de día se suman (corre si se cumple cualquiera), y el lío del 1 = lunes o domingo.
- **Convertir** entre estándar y Quartz cuando hay equivalente exacto (ajusta la numeración de
  la semana, agrega segundos y `?`); si no lo hay, lo dice.
- **Snippets** de C#: Hangfire (`RecurringJob.AddOrUpdate` con `TimeZone`), Quartz.NET
  (`WithCronSchedule(..., x => x.InTimeZone(...))`) y NCrontab, con la zona elegida.
- Nueve ejemplos de un toque, link compartible (`?e=...&m=...&z=...`), último estado en
  `localStorage`, y una chuleta con las diferencias entre dialectos y las trampas de siempre.

## Decisiones

- Las reglas de Quartz se copian tal cual: `?` obligatorio en uno de los dos campos de día (y en
  uno solo), `W` no se sale del mes, `L` solo en día de la semana es sábado, `L-3` es tres días
  antes de fin de mes, `1/5` arranca en 1.
- En cron estándar se sigue la semántica de Vixie cron (la misma que usa Cronos, que es lo que
  usa Hangfire): si día del mes y día de la semana están los dos restringidos, corre cuando se cumple
  cualquiera. `7` es domingo. Los rangos de día de la semana con vuelta (`FRI-MON`) se aceptan.
- Las fechas se calculan con `Intl.DateTimeFormat` sobre la zona elegida, sin librerías: la
  búsqueda salta de a mes, día, hora, minuto o segundo según el primer campo que no coincide, y se
  corta a los 8 años si no encuentra nada (30 de febrero, año pasado).
- La frase prioriza lo que se dice de verdad ("a las 09:00 y 17:00", "el 25 de diciembre",
  "el segundo martes del mes") sobre la traducción literal de cada campo.

## Cómo se prueba

Lógica pura, sin navegador (parser, dialectos, errores, avisos, 30 frases, próximas ejecuciones con
fechas conocidas en Argentina, UTC y con cambio de horario, L/W/#, conversión, snippets):

```bash
node --test herramientas/cron-en-criollo/tests/*.test.js
```

Recorrido en Chromium headless a 360 px y 1280 px (ejemplos, error con arreglo, convertir, avisos,
zonas horarias, pestañas de código, dialecto forzado, recarga, URL, copiar, controles de 40 px, modo
oscuro, sin errores de consola):

```bash
npm i -D playwright && npx playwright install chromium   # una sola vez
node herramientas/cron-en-criollo/tests/e2e.js
```

Lo que **no se pudo probar** en la nube es correr las expresiones contra Quartz.NET, Cronos y
NCrontab reales (no hay `dotnet`); las reglas se tomaron de la documentación y el código fuente de
cada librería y se cubrieron con casos conocidos en los tests.

## Archivos

```
index.html        interfaz y el script de la página
logica.js         parser, descripción en castellano, próximas ejecuciones, conversión y snippets; anda en el navegador y en Node
tests/            logica.test.js (node --test) y e2e.js (Playwright)
```
