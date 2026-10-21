# Bloqueos con el cronómetro en la mano

Diez capítulos sobre bloqueos, niveles de aislamiento y deadlocks de SQL Server, cada uno con un
experimento hecho con dos o más sesiones a la vez contra un servidor real: qué toma un `UPDATE` y a
quién frena (incluido el reporte que se traba por una página), la escalada a los 5.000 bloqueos,
`NOLOCK` (lectura sucia y 38 de 40 conteos distintos), la actualización perdida con seis remedios
medidos (RC, RCSI, `REPEATABLE READ`, `UPDLOCK`, atómico, `rowversion`, `SNAPSHOT`), `SERIALIZABLE`
y el «si no existe, insertar» (el default de `TransactionScope`), el deadlock clásico con su grafo de
`system_health` explicado, el deadlock que arregla un índice, `LOCK_TIMEOUT` contra `CommandTimeout` y
cómo encontrar la cabeza de una cadena de bloqueos, RCSI y `SNAPSHOT` con lo que cuestan, y la fila
caliente (rendimiento = 1 / duración de la transacción). Cierra con conclusión, chuleta y qué cambia
en el código .NET. Hermano de [Índices con el cronómetro en la mano](../indices-con-cronometro/).

**Leer:** https://fnguerrero.github.io/working-folder-auto/escritos/bloqueos-con-cronometro/

**Estado:** terminado.

## Qué lo distingue

**Todos los números son medidos con sesiones concurrentes de verdad.** Se levantó SQL Server 2022
(Developer, Linux, 4 CPU) con una base «Bloqueos» (200.000 pedidos, 2.000 productos, 10.000 clientes,
4 cuentas) y `medir/medir.js` abre desde Node las sesiones que cada experimento necesita (una
transacción por sesión, así cada una queda pegada a su conexión), las lanza a la vez, mide lo que
tarda cada una y, mientras esperan, mira `sys.dm_exec_requests`, `sys.dm_tran_locks`,
`sys.dm_tran_version_store_space_usage` y `sys.dm_db_index_physical_stats` desde otra conexión. Los
grafos de deadlock salen del *ring buffer* de `system_health`. Está todo en `resultados.json` tal
cual salió, y `tests/datos.test.js` verifica que las cifras del texto son esas.

Hallazgos que valen la lectura: RCSI **no** arregla la actualización perdida; `REPEATABLE READ` la
arregla pero a 1.577 deadlocks por 40 descuentos; el `COUNT(*)` pasa por arriba de una transacción
abierta y el `SUM(Total)` no (cuenta por otro índice); el monitor de deadlocks tarda hasta 5 s la
primera vez y 100 ms las siguientes; y el deadlock más común no tiene orden cruzado, tiene un
`WHERE` sin índice.

## Archivos

- `index.html`: el escrito, una sola página sin dependencias.
- `resultados.json`: lo que midió el servidor, generado por `medir/medir.js`.
- `medir/medir.js` y `medir/setup.sql`: el runner y la base. Para repetirlo hace falta Node 18+, `npm i mssql` en `medir/` y un SQL Server con la clave de `sa` en `MSSQL_SA_PASSWORD`:
  `docker run -d --name sql -p 1433:1433 -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=<una clave> -e MSSQL_PID=Developer mcr.microsoft.com/mssql/server:2022-latest` y después `MSSQL_SA_PASSWORD=<la misma> node medir/medir.js`. Tarda unos 7 minutos (el capítulo 4 con `REPEATABLE READ` es el lento). Se puede correr un experimento solo: `node medir/medir.js deadlock`.
- `experimentos.sql`: la misma coreografía para repetir a mano en SSMS con dos ventanas.
- `tests/datos.test.js` y `tests/e2e.js`.

## Decisiones

- Mismo esqueleto que los otros escritos: índice lateral fijo en escritorio y desplegable en el celular, modo oscuro, botón de copiar en cada bloque, tablas con scroll propio, cuadro «Qué me llevo» por capítulo. Lo nuevo son los bloques «Ventana 1 / Ventana 2» lado a lado.
- El driver `mssql` envuelve `query()` en `sp_executesql`, con lo que `SET LOCK_TIMEOUT` y compañía no quedan en la sesión; el runner usa `batch()`. Y como el nivel de aislamiento y los `SET` quedan pegados a la conexión del pool, los experimentos que los cambian usan un pool descartable.
- Los tiempos se presentan con la salvedad de que son de un contenedor sin carga. Lo que importa es el orden de magnitud y la comparación entre variantes.
- Cuando algo contradice la intuición se dice: RCSI no es un remedio para la actualización perdida, `REPEATABLE READ` es el peor remedio, `NOLOCK` cuenta de menos y no «un poco viejo».

## Cómo se prueba

```
node --test escritos/bloqueos-con-cronometro/tests/*.test.js
node escritos/bloqueos-con-cronometro/tests/e2e.js      # Chromium headless, 360 y 1280 px, claro y oscuro
```

## Qué no se pudo probar

Todo se midió en Linux en un contenedor; en Windows los números cambian (sobre todo los tiempos
hasta el deadlock, que dependen del monitor) pero no el comportamiento. El `CommandTimeout` se probó
con el `requestTimeout` del driver de Node, que hace lo mismo que `SqlCommand.CommandTimeout`
(cancelar el pedido); en .NET el error es `SqlException` con `Number = -2`.
