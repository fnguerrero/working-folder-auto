# Plan en criollo

Pegás un plan de ejecución de SQL Server (el XML, o abrís el archivo `.sqlplan`) y te dice en
castellano qué está pasando, dónde se va el tiempo y qué hacer: índices que faltan (con el script),
Key Lookups por miles, conversiones implícitas que anulan un índice, parameter sniffing, derrames a
tempdb, memoria de más, funciones escalares por fila, joins sin condición, spools, timeouts del
optimizador, esperas... Cada hallazgo tiene gravedad, «qué pasa» y «qué hacer», y un botón que te
lleva al operador en el árbol. Todo pasa en el navegador: el plan no se sube a ningún lado.

**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/plan-en-criollo/

**Estado:** terminado.

## Qué hace

- **Lee el XML** del plan (parser propio, sin dependencias): estimado o real, una o varias sentencias
  (`StmtSimple`, `StmtCond` con `IF`, cursores), planes paralelos (suma los contadores por hilo),
  Adaptive Join (detecta la rama que no se ejecutó y la saca de los costos), planes pegados desde
  eventos extendidos o Query Store.
- **Diagnóstico** ordenado por gravedad (serio / mirar / menor / dato), con 25 reglas. Entre otras:
  índices faltantes con `CREATE INDEX` listo; Key/RID Lookup con el índice cubriente sugerido (`INCLUDE`
  + `DROP_EXISTING`); recorridos de tablas grandes con filtro, distinguiendo `LIKE '%…'`, funciones sobre
  columnas y `CONVERT_IMPLICIT`; seeks con predicado residual; estimado vs. real con la causa probable
  (parámetros, variables de tabla, temporales, funciones, estadísticas); spills de sort y hash; concesión
  de memoria excesiva y espera por memoria; conversión implícita con el arreglo para Dapper, EF Core y
  ADO.NET; join sin predicado; columnas sin estadísticas; parameter sniffing (valor compilado vs.
  ejecutado); timeout del optimizador; Index Spool y Table Spool; sorts caros; bucles anidados con lado
  interno pesado; funciones escalares (con el tiempo de UDF cuando el plan lo trae); razón de no
  paralelismo traducida; esperas dominantes explicadas; compilación cara; plan trivial; parametrización
  simple; CE legado; meta de filas (row goal); modificaciones con sus índices.
- **El árbol** del plan con la raíz arriba: porcentaje del costo, nombre en castellano y en inglés,
  objeto, filas estimadas → reales (en rojo si difieren 10×), ejecuciones o hilos, lecturas, tiempo y
  avisos. Clic en cualquier operador para el detalle: qué hace, por qué busca, qué filtra, orden, claves
  de hash, memoria, costo propio, columnas que devuelve.
- **Lo que más pesa**, **datos de la consulta** (servidor, tipo, costo, paralelismo, tiempos, lecturas,
  memoria, compilación, hashes), **parámetros** compilado vs. ejecutado y **esperas** con su significado.
- Copiar el árbol como texto o el diagnóstico completo; abrir `.sqlplan` por botón o arrastrando;
  guarda el último plan en `localStorage`; glosario de 50 operadores con filtro; cómo conseguir el plan
  desde SSMS, Azure Data Studio, código, Query Store y la caché.
- 12 ejemplos de un toque: son **planes reales**, generados contra SQL Server 2022.

## Decisiones

- El porcentaje de cada operador es su costo propio (subárbol menos hijos) sobre el de la sentencia;
  con metas de filas (TOP, EXISTS) el padre puede costar menos que la suma de los hijos, y se normaliza
  a 100. Es estimado: cuando las filas estimadas y reales difieren, se avisa que los porcentajes mienten.
- Las filas estimadas de un operador se muestran «para todas las ejecuciones» (filas × (1 + rebinds +
  rewinds)), igual que SSMS, para que se puedan comparar con las reales.
- En planes paralelos los contadores reales se suman entre hilos (filas, ejecuciones, lecturas) y el
  tiempo transcurrido es el máximo; no se multiplica por ejecuciones porque los contadores por hilo ya
  son acumulados.
- Los hallazgos se ordenan por gravedad y no se repiten: si la conversión implícita explica el scan, no
  se reporta el scan; si el lookup está en el lado interno de un Nested Loops, no se reporta el loop.
- Los textos de «qué hacer» están pensados para alguien que programa en .NET: `OPTION (RECOMPILE)`,
  `DbString { IsAnsi = true }`, `.IsUnicode(false)`, funciones inline, PSP optimization de 2022.
- El parser XML es propio para que la misma lógica corra en Node (tests) y en el navegador, y para dar
  errores en castellano («se cierra `<a>` pero estaba abierto `<b>`», «¿se cortó al copiar?»).

## Cómo se prueba

Lógica pura, sin navegador. Usa 20 planes reales de SQL Server 2022 (carpeta `tests/planes/`) y XML
armados a mano para lo que no se pudo reproducir (columnas sin estadísticas, Index Spool, CE 70,
`StmtCond`, cursores, plan dentro de un evento extendido):

```bash
node --test herramientas/plan-en-criollo/tests/*.test.js
```

Recorrido en Chromium headless a 360 px y 1280 px (ejemplos, hallazgos, detalle del árbol, resaltado
desde un hallazgo, plan paralelo, plan estimado, errores, abrir `.sqlplan`, recarga con lo guardado,
copiar, glosario, controles de 40 px, modo oscuro, sin scroll horizontal ni errores de consola):

```bash
npm i -D playwright && npx playwright install chromium   # una sola vez
node herramientas/plan-en-criollo/tests/e2e.js
```

### Cómo se generaron los planes de ejemplo

Se levantó SQL Server 2022 (Developer, Linux) en Docker con una base «Tienda» (50.000 clientes,
400.000 pedidos con un mayorista que tiene 100.000, 1,2 millones de ítems) y se corrieron consultas
armadas para provocar cada problema: `SET STATISTICS XML ON` desde Node con el driver `mssql` y se
guardó el plan que volvió. El script no está en el repo (tiene la contraseña del contenedor), pero la
receta es esa.

Lo que **no se pudo probar**: planes de versiones viejas (2008/2012, esquema showplan anterior),
columnstore, cursores reales, `ColumnsWithNoStatistics` y `Index Spool` reales (SQL Server 2022 no
los produjo con las consultas probadas; están cubiertos con XML a mano), ni planes muy grandes
(cientos de operadores) en celular.

## Archivos

```
index.html        interfaz y el script de la página
logica.js         parser XML, modelo del plan, diagnóstico, glosario; anda en el navegador y en Node
ejemplos.js       los 12 planes reales de los botones de ejemplo
tests/            logica.test.js (node --test), e2e.js (Playwright) y planes/*.sqlplan (20 planes reales)
```
