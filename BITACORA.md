# Bitácora del Programador nocturno

Una entrada por noche, la más nueva arriba.

## 2026-10-11
- **Por qué explota el p99** (experimentos, nuevo, terminado): simulador de colas para backend: workers, pedidos por segundo y distribución del tiempo de servicio; simulación de eventos discretos contrastada con Erlang C, Allen-Cunneen y Little, tres gráficos (palo de hockey, histograma, cola en el tiempo), diagnóstico en criollo con acciones y texto con fuentes. Tests `node --test` (simulación vs fórmulas) y e2e a 360 y 1280 px. Probar: https://fnguerrero.github.io/working-folder-auto/experimentos/colas-p99/
- **Cron en criollo** (herramientas, nuevo, terminado): pegás una expresión cron (estándar o Quartz.NET con `?`, `L`, `W`, `#` y año) y la explica en castellano, con las próximas 10 ejecuciones en hora argentina, avisos de las trampas típicas, conversión entre dialectos y snippets de Hangfire, Quartz y NCrontab. Tests con fechas conocidas y e2e. Probar: https://fnguerrero.github.io/working-folder-auto/herramientas/cron-en-criollo/
- Ideas nuevas: #8 (feriados y días hábiles de Argentina), #9 (cuentos para Valentín, grande), #10 (datos de prueba argentinos: CUIT, CBU, DNI).
- Sin pedidos `noche` en ninguno de los tres repos. Nota: el clon arrancó en HEAD suelto con `main` local vieja; se re-apuntó `main` al commit (fast-forward) antes de pushear.

## 2026-10-10
- **JSON a C#** (herramientas, nuevo, terminado): pegás un JSON y salen las clases o records de C# para System.Text.Json o Newtonsoft, con tipos inferidos (anulables, fechas, GUID, diccionarios), opciones de estilo y una pestaña TypeScript. Parser propio con errores por línea y columna. Tests con `node --test`, e2e en Chromium a 360 y 1280 px, y el TypeScript validado con `tsc`. Probar: https://fnguerrero.github.io/working-folder-auto/herramientas/json-a-csharp/
- Ideas nuevas: #5 (guía Newtonsoft → System.Text.Json), #6 (plazo fijo vs dólar vs inflación con datos históricos), #7 (visor de logs JSON en el navegador).
- Sin pedidos `noche` en ninguno de los tres repos.

## 2026-10-09
- **Mudanza** (repo): arranca working-folder-auto. Se trajeron Simón dice y Globos (desde juegos-nocturnos) y Cuotas en curso (desde taller-nocturno), y las 4 ideas pendientes como issues #1 a #4. Probar: https://fnguerrero.github.io/working-folder-auto/
