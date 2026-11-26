# LINQ con el cronómetro en la mano

Nueve capítulos sobre lo que cuesta LINQ en .NET 8, 9 y 10, medido: `Where`/`Select` contra un `for`, `Any()`
contra `Count() > 0`, el `ToList()` de más, `First` contra `Find`, `OrderBy().First()` contra `MinBy`, la
enumeración múltiple, qué cambió en los iteradores especializados, búsquedas adentro de un bucle y los detalles
que se discuten en un code review. Cierra con la tabla «si ves esto, hacé esto».

**Leer:** https://fnguerrero.github.io/working-folder-auto/escritos/linq-con-cronometro/

**Estado:** terminado.

## Cómo se midió

- **No es BenchmarkDotNet** (el pedido lo mencionaba, pero no estaba en la caché local de NuGet y no se
  descargaron paquetes). Es un arnés propio (`benchmarks/Arnes.cs`): calibración, calentamiento, 12 muestras,
  mediana y rango, asignaciones con `GC.GetAllocatedBytesForCurrentThread`.
- .NET 8.0.34, 9.0.21 y 10.0.13, Windows 11 x64, 16 procesadores lógicos, GC de estación. Dos corridas completas
  por runtime, una detrás de otra.
- Antes de medir se verifica que las variantes de cada grupo devuelvan el mismo resultado.
- La máquina tenía otros procesos andando: sirve para comparar órdenes de magnitud. Varias celdas se mueven
  bastante entre corridas y la página las marca con ≈.
- Las salidas tal cual están en `resultados-crudos/`; `tablas.js` las junta en `resultados.json` y genera las
  tablas y los bloques de código (desde `benchmarks/Casos.cs`) dentro de `index.html`.

## Cómo se prueba

```bash
node --test escritos/linq-con-cronometro/tests/*.test.js
node escritos/linq-con-cronometro/tests/e2e.js      # necesita Playwright; CANAL=msedge usa Edge
```

Para volver a medir (SDK de .NET 10, sin paquetes; compilar en una copia para no dejar `bin/` y `obj/` acá):

```bash
dotnet build -c Release
dotnet bin/Release/net8.0/Benchmarks.dll verificar
dotnet bin/Release/net8.0/Benchmarks.dll medir linq.json
node ../tablas.js    # después de copiar los json a resultados-crudos/
```

## Qué no se pudo probar

BenchmarkDotNet, Linux, ARM, GC de servidor, otros tamaños y distribuciones de datos, PLINQ y `AggregateBy`.
Las explicaciones sobre por qué una variante gana no se verificaron mirando el código generado por el JIT.
