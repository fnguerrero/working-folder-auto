# Fechas en criollo

Pegás una fecha, un epoch (segundos, milisegundos o microsegundos) o los ticks de .NET, y te muestra el mismo instante
en UTC, Argentina, Uruguay, Chile, Brasil, México, Nueva York, Madrid y Londres. Sirve para el clásico «la base guarda
en UTC y el reloj de mi pantalla dice otra cosa». Además da los valores técnicos (ISO 8601, epoch, ticks) con botón de
copiar, un snippet de C# con `DateTimeOffset` y `TimeZoneInfo`, y la diferencia entre dos momentos.

**Estado:** terminado. **Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/fechas-en-criollo/

- Una hora sin zona (`13/11/2026 04:00` o `2026-11-13 04:00`) se interpreta en la zona que elijas; con `Z` o con desfase, se respeta el que trae.
- Los desfases salen de la base de zonas horarias del navegador (`Intl`), así que los horarios de verano de Madrid, Nueva York o Santiago son los reales de esa fecha.
- Todo corre en el navegador; no se envía ni se guarda nada.
- Tests: `node --test herramientas/fechas-en-criollo/tests/logica.test.js` (11) y e2e con Playwright (`herramientas/fechas-en-criollo/tests/e2e.js`, `EDGE=1` usa el Edge del sistema) a 360 y 1280 px.
- No probado: las horas ambiguas o inexistentes de un cambio de horario (la lógica resuelve con una iteración, sin test propio) ni un celular real.
