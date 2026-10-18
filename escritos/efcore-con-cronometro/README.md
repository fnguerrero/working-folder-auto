# EF Core con el cronómetro en la mano

Trece experimentos sobre lo que Entity Framework Core manda al servidor y lo que trae de vuelta, medidos
contra un SQL Server 2022 de verdad: el N+1 (explícito y con lazy loading), la explosión cartesiana de dos
`Include`, lo que cuesta el change tracker (y la trampa de inicializar las colecciones de navegación con
`List`), proyectar contra traer la entidad, paginar con `Skip` contra keyset, `Contains` con listas de ids
(OPENJSON de EF Core 8 contra `IN` con literales), `Any()` contra `Count() > 0` contra `ToList().Any()`,
insertar de a muchos (`SaveChanges` en el bucle, `AddRange`, `SqlBulkCopy`), `ExecuteUpdate` y
`ExecuteDelete` contra cargar y guardar, buscar por clave (lo que cuesta EF, lo que cuesta crear el contexto,
`Find` contra `First` contra `Local`, Dapper y ADO.NET), varchar contra nvarchar y la sargabilidad desde LINQ,
parámetros contra constantes y la caché de planes, y sincrónico contra asincrónico (con el problema de
SqlClient con las columnas grandes). Cada capítulo tiene el código, la tabla medida, el SQL que EF mandó y
«qué me llevo»; cierra con una conclusión, una chuleta y cómo reproducirlo. Es el hermano de «Índices con el
cronómetro en la mano»: aquel mira el servidor, este mira lo que EF le pide.

**Leer:** https://fnguerrero.github.io/working-folder-auto/escritos/efcore-con-cronometro/

**Estado:** terminado.

## Qué lo distingue

**Todos los números son medidos.** El proyecto `experimentos/` (.NET 8, EF Core 8.0.32, Microsoft.Data.SqlClient
5.1.9, Dapper 2.1.89) crea la base «Tienda» (50.000 clientes, 400.000 pedidos con un campo de notas, 1,2 millones
de ítems, 1,6 millones de eventos, 500 documentos de 80 KB) con `SqlBulkCopy` y corre cada variante seis veces
con un contexto nuevo: la primera se descarta (compilación de la consulta y JIT, queda anotada como `primeraMs`) y
de las otras cinco se toma la mediana. Por cada corrida mide tiempo, viajes al servidor y bytes recibidos
(estadísticas de `SqlConnection`), lecturas lógicas (`sys.dm_exec_sessions`), filas devueltas, memoria asignada
en .NET (`GC.GetTotalAllocatedBytes`) y captura el SQL con un `DbCommandInterceptor`. `resultados.json` es la
salida tal cual, y **las 13 tablas y los 13 bloques «lo que mandó EF» de la página se generan desde ese JSON
con `tablas.js`**, no se tipean. Corrió en Docker: `mcr.microsoft.com/dotnet/sdk:8.0` con 2 vCPU y SQL Server
2022 Developer con otras 2, en la misma máquina.

Lo que más vale la lectura: `Include(p => p.Cliente)` rastreando 20.000 pedidos del mismo cliente tarda
1,9 s en vez de 170 ms porque la colección de navegación estaba inicializada como `List` (EF hace `Contains`
antes de agregar); `SaveChanges` adentro de un `foreach` de 2.000 inserciones tarda 6,4 s y asigna 1,7 GB
(DetectChanges es cuadrático); `DbSet.Local.FirstOrDefault` 2.000 veces con 2.000 entidades rastreadas asigna
3,4 GB; `ToListAsync()` sobre 500 textos de 80 KB tarda 6 veces más que `ToList()` y asigna 944 MB
(dotnet/SqlClient#593); un `string` sin `IsUnicode(false)` contra una columna varchar recorre el índice entero;
y la consulta «bien escrita» con `Where`, `OrderByDescending` y `Take(10)` hizo 957.000 lecturas hasta que
apareció el índice que faltaba.

## Decisiones

- Mismo esqueleto que los otros escritos (índice lateral fijo en escritorio y desplegable en el celular, modo
  oscuro, botón de copiar en cada bloque, cuadro «Qué me llevo»), con una tabla por capítulo de ocho columnas
  (variante, tiempo con barra, relación con la base, viajes, lecturas, filas, bytes recibidos, memoria .NET) y
  los bloques de SQL marcados como «lo que mandó EF».
- Se mide con las versiones sincrónicas salvo en el capítulo 13, para que los tiempos sean comparables entre
  capítulos.
- Las lecturas se toman de la sesión de la misma conexión (se abre una `SqlConnection` y se le pasa a cada
  `DbContext`), descontando lo que cuesta preguntar la DMV. Los viajes y bytes vienen de
  `SqlConnection.StatisticsEnabled`.
- Cuando el resultado contradice la intuición se dice: `AsNoTrackingWithIdentityResolution` fue más lento que
  rastrear; la proyección con dos colecciones también es cartesiana en EF Core 8; apagar
  `AutoDetectChangesEnabled` no cambia nada con `AddRange`.
- Las versiones de los paquetes en el JSON se tomaron de `obj/project.assets.json` después de la corrida (el
  programa anota las versiones de ensamblado, que no coinciden con las del paquete).

## Cómo se prueba

Coherencia entre texto y datos: `tests/datos.test.js` verifica que cada fila de cada tabla tenga los seis
números de su medición tal cual los formatea `tablas.js`, que cada bloque de SQL sea el capturado, y que las
afirmaciones de la prosa (× más lento, viajes, lecturas, MB, segundos) salgan de `resultados.json` dentro de
una tolerancia:

```bash
node --test escritos/efcore-con-cronometro/tests/*.test.js
```

Recorrido en Chromium headless a 360 px y 1280 px (índice generado, navegación, sección activa, copiar, tablas,
enlaces a los datos, modo oscuro, sin scroll horizontal ni errores de consola):

```bash
node escritos/efcore-con-cronometro/tests/e2e.js   # necesita Playwright con Chromium
```

Para repetir las mediciones hace falta un SQL Server y el SDK de .NET 8; está explicado en el apéndice de la
página y en `experimentos/`. Lo que **no se pudo probar**: los mismos experimentos en Windows, contra una base
en otra máquina (donde cada viaje cuesta más y los capítulos de N+1 e inserciones se ponen peores de lo que se
ve acá) y con SQL Server bajo carga real.

## Archivos

```
index.html         el escrito (las tablas y los bloques de SQL los genera tablas.js)
resultados.json    lo que se midió, tal cual, con el SQL capturado de cada variante
tablas.js          genera las tablas y los bloques de SQL en index.html desde el JSON
experimentos/      proyecto .NET 8: modelo, carga de la base, medidor y los 13 capítulos
tests/             datos.test.js (node --test) y e2e.js (Playwright)
```
