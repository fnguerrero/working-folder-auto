# Async con el cronómetro en la mano

Ocho capítulos sobre lo que cuesta `async`/`await` en .NET, medidos: un `await` que completa sincrónicamente
contra uno que suspende, `Task` contra `ValueTask`, `ConfigureAwait(false)` con y sin contexto, sync-over-async
bajo carga (con gráfico interactivo de hilos y pedidos por segundo), `async void`, `Task.Run` adentro de una API,
`IAsyncEnumerable` contra la lista entera y las asignaciones del `ValueTask` mal usado. Cierra con una tabla
«si ves esto, hacé esto».

**Leer:** https://fnguerrero.github.io/working-folder-auto/escritos/async-con-cronometro/

**Estado:** terminado.

## Cómo se midió

- **No es BenchmarkDotNet** (el pedido lo mencionaba, pero no estaba en la caché local de NuGet y no se
  descargaron paquetes). Es un arnés propio (`benchmarks/Arnes.cs`): calibración, calentamiento, 12 muestras,
  mediana y rango, asignaciones con `GC.GetAllocatedBytesForCurrentThread` o `GC.GetTotalAllocatedBytes` cuando
  la operación salta de hilo.
- .NET 8.0.34 y .NET 10.0.13, Windows 11 x64, 16 procesadores lógicos, GC de estación. Dos corridas completas
  por runtime. El escenario de thread pool corre una vez por combinación (2 runtimes × 4 variantes × 4 ritmos,
  10 segundos de carga cada uno, un proceso por escenario).
- La máquina tenía otros procesos andando: sirve para comparar órdenes de magnitud.
- Las salidas tal cual están en `resultados-crudos/`; `tablas.js` las junta en `resultados.json` y genera las
  tablas, los bloques de código (desde `benchmarks/*.cs`) y los datos del gráfico dentro de `index.html`.

## Cómo se prueba

```bash
node --test escritos/async-con-cronometro/tests/*.test.js
node escritos/async-con-cronometro/tests/e2e.js      # necesita Playwright; CANAL=msedge usa Edge
```

Para volver a medir (SDK de .NET 10, sin paquetes; compilar en una copia para no dejar `bin/` y `obj/` acá):

```bash
dotnet build -c Release
dotnet bin/Release/net8.0/Benchmarks.dll micro micro.json
dotnet bin/Release/net8.0/Benchmarks.dll hambre hambre.json result 400 10
node ../tablas.js    # después de copiar los json a resultados-crudos/
```

## Qué no se pudo probar

BenchmarkDotNet, Linux, una máquina con pocos núcleos, GC de servidor, ASP.NET Core con pedidos HTTP reales
(el thread pool se carga directo), una UI real (el contexto de un hilo está armado a mano) y la explicación de
por qué el pool se queda en 132 hilos (se infiere de lo medido, no se instrumentó el runtime).
