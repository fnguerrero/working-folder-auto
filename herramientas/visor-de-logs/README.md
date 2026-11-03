# Visor de logs

Abrís un log (o varios) en el navegador y lo recorrés como una tabla: nivel, hora, mensaje y propiedades, con filtros y la vista «misma petición». Es lo que hace Seq, pero sin instalar nada y sin que el archivo salga de tu máquina (no hay red: todo se lee con `File` y se parsea acá).

**Estado:** terminado (sugerencia #7).
**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/visor-de-logs/ (el botón «Cargar un log de muestra» arma uno de ejemplo).

## Qué entiende
- Serilog compact (`@t`, `@mt`, `@l`, `@x`; la plantilla se renderiza con las propiedades) y Serilog JSON normal (`Timestamp`, `Level`, `MessageTemplate`, `Properties`).
- `JsonConsoleFormatter` de ASP.NET (`LogLevel`, `Category`, `State`, `Scopes`).
- NLog JSON y JSON genérico (`time`/`level`/`message`/`exception`).
- La consola de .NET (`warn: Categoria[4]` + mensaje en la línea siguiente) y texto con fecha y nivel (`2026-11-03 10:00:00.123 [ERR] ...`). Las líneas sin fecha se pegan a la entrada anterior (stack traces).
- Varios archivos a la vez: se ordenan por hora y se puede filtrar por archivo.

## Filtros
Niveles (con conteo), texto (o regex), tiempo (UTC), y propiedades: `UserId=42`, `Path~/api` (contiene), `Status!=200`, `RequestId` (existe); se combinan con espacio y las claves no distinguen mayúsculas. Al tocar una fila se ven todas las propiedades y la excepción; los botones «Ver RequestId …» filtran esa petición. «Agrupar por petición» lista las peticiones (RequestId, TraceId, CorrelationId…) con cantidad, duración y peor nivel. Exporta lo filtrado a JSON o CSV (`;`, con BOM, para Excel en español).

## Cómo se prueba
- `node --test tests/logica.test.js`: 10 tests (cada formato, filtros, agrupado, export, 200 mil líneas).
- `node tests/e2e.js` (necesita Playwright): muestra, filtros, detalle, agrupado, descarga, y un archivo de **50 MB / 219 mil líneas generado en el momento** a 360 y 1280 px. Lo lee en ~2,5 s.

## Supuestos y límites
- Una hora sin zona horaria se toma como UTC; la tabla y los filtros siempre muestran UTC.
- Se leen de a 8 MB. Todas las entradas quedan en memoria (parseadas); un log de 300 MB con líneas cortas puede pedir varios GB, y ahí conviene filtrar el archivo antes. No se probó con archivos de ese tamaño.
- Solo UTF-8. No probado con logs reales de producción, solo con muestras armadas a mano según la documentación de cada formato.
