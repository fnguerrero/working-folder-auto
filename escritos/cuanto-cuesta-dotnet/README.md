# Cuánto cuesta cada cosa en .NET 8

Un escrito con 129 microbenchmarks sobre las discusiones de todos los días en un equipo .NET, medidos con
BenchmarkDotNet en un .NET 8 real y no de oído: armar y comparar texto, `Split` contra `Span`, listas y
LINQ, buscar por clave, `struct` como clave de diccionario, boxing y clausuras, excepciones, enums, regex
(interpretada, compilada, generada), JSON (System.Text.Json, Newtonsoft, source generator), reflexión y
llamadas virtuales, async de más y de menos, `lock` contra `Interlocked`, logging que no se ve pero se paga,
fechas y GUID. Dieciséis capítulos con el código de cada benchmark, la tabla medida (tiempo, relación con la
base y memoria por operación), una explicación de por qué da lo que da y «qué me llevo»; una chuleta final
que separa lo que importa de lo que no, y un apéndice para reproducirlo.

**Leer:** https://fnguerrero.github.io/working-folder-auto/escritos/cuanto-cuesta-dotnet/

**Estado:** terminado.

## Qué lo distingue

**Todos los números son medidos.** El proyecto `benchmarks/` (BenchmarkDotNet 0.14, .NET 8.0.32, Release,
TieredPGO, `MemoryDiagnoser`) corrió completo dentro de `mcr.microsoft.com/dotnet/sdk:8.0` en Docker con
2 vCPU asignadas, con `Job.ShortRun` (3 calentamientos, 5 iteraciones). `resultados.json` es la exportación
compacta del reporte (`benchmarks/exportar.py`), y **las 17 tablas de la página se generan desde ese JSON
con `tablas.js`**, no se tipean. El texto dice siempre que los valores absolutos son de esa máquina y que lo
que viaja son las relaciones entre variantes.

Algunos resultados que valen la lectura: un `throw`+`catch` cuesta 6 a 8 µs (mil veces un `if`);
`FirstOrDefault` adentro de un bucle contra un diccionario, 200×; `new Regex` por llamada, 22× y 6 KB;
`StartsWith` sin `StringComparison`, 8 a 12× por pasar por la cultura; un `LogDebug` apagado con
interpolación, 94 ns y 96 B para nada; una llamada virtual o por interfaz, 0,08 ns más que una directa.

## Decisiones

- Mismo esqueleto que los otros escritos (índice lateral fijo en escritorio y desplegable en el celular,
  modo oscuro, botón de copiar en cada bloque, cuadro «Qué me llevo»), con una tabla por capítulo: variante,
  media por operación con barra proporcional, relación con la base en palabras («5,4× más lento», «2,2× más
  rápido», «igual») y memoria por operación.
- Cada benchmark devuelve lo que calcula y arma sus datos en el constructor, siguiendo las buenas
  prácticas de BenchmarkDotNet. Los bloques de código de la página son el código medido (recortado donde
  se repite).
- `ShortRun` en vez del job por defecto: la corrida completa tarda 45 minutos en vez de horas, y para
  comparar variantes alcanza. El texto lo dice.
- `WhenAll100` se corrió por separado después de corregir un bug de captura de variable en el benchmark
  (el `i` del `for` adentro del `Task.Run`); el exportador pisa el resultado del reporte conjunto con el de
  la corrida suelta.

## Cómo se prueba

Coherencia entre texto y datos: `tests/datos.test.js` verifica que cada tabla tenga la media y la memoria
de cada benchmark tal cual las formatea `tablas.js`, que cada benchmark tenga su bloque de código, y que las
afirmaciones de la prosa (× más lento, bytes por operación, nanosegundos) salgan de `resultados.json`
dentro de una tolerancia:

```bash
node --test escritos/cuanto-cuesta-dotnet/tests/*.test.js
```

Recorrido en Chromium headless a 360 px y 1280 px (índice generado, navegación, sección activa, copiar,
tablas, enlaces a los datos, modo oscuro, sin scroll horizontal ni errores de consola):

```bash
node escritos/cuanto-cuesta-dotnet/tests/e2e.js   # necesita Playwright con Chromium
```

Para volver a medir (hace falta el SDK de .NET 8; con Docker, `docker run --rm -v "$PWD":/w -w /w
mcr.microsoft.com/dotnet/sdk:8.0 dotnet run -c Release -- --filter '*'`):

```bash
cd escritos/cuanto-cuesta-dotnet/benchmarks && dotnet run -c Release -- --filter '*'
python3 exportar.py . ../resultados.json && node ../tablas.js
```

Lo que **no se pudo probar**: los mismos benchmarks en Windows, con más núcleos o con el job completo de
BenchmarkDotNet; `Guid.CreateVersion7` y el `Split` de spans de .NET 9 se mencionan pero no se midieron.

## Archivos

```
index.html         el escrito (las tablas entre <!-- tabla:X --> y <!-- /tabla --> las genera tablas.js)
resultados.json    lo que midió BenchmarkDotNet, compactado
tablas.js          genera las tablas de index.html desde resultados.json
benchmarks/        el proyecto .NET 8: un archivo por capítulo, Program.cs con la config, exportar.py
tests/             datos.test.js (node --test) y e2e.js (Playwright)
```
