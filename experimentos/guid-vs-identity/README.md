# GUID o identity: qué le pasa al índice

Un B+tree implementado en JavaScript, con páginas de 8 KB, hojas encadenadas y numeración física
de páginas, al que se le insertan claves de cuatro tipos para medir qué pasa con el índice:

| Clave | Cómo se genera | Modela |
|---|---|---|
| `int identity` | 1, 2, 3… | `IDENTITY`, `serial` |
| GUID aleatorio | v4 con un PRNG determinista | `NEWID()`, `Guid.NewGuid()`, `gen_random_uuid()` |
| GUID v7 | tiempo en ms adelante, bits aleatorios dentro del ms | `Guid.CreateVersion7()` de .NET 9 |
| GUID secuencial estricto | monótono siempre | `NEWSEQUENTIALID()`, `SequentialGuidValueGenerator` de EF Core |

Para cada uno mide páginas hoja y tamaño, llenado, divisiones de página, fragmentación lógica y
"páginas calientes" (hojas distintas escritas en las últimas 1.000 inserciones). Se elige cuántas
filas, cuánto mide el resto de la fila, qué motor (cómo divide la última página: SQL Server deja la
vieja llena, PostgreSQL al 90 %, el B-tree de libro a la mitad), cuántas inserciones por
milisegundo (afecta al v7) y una semilla. Hay un gráfico del llenado a medida que se inserta,
barras comparativas, un diagnóstico escrito con los números y un texto largo con qué significa,
qué hacer y fuentes.

**Estado:** terminado.
**Probar:** https://fnguerrero.github.io/working-folder-auto/experimentos/guid-vs-identity/

## Qué sale

- GUID aleatorio: llenado ≈ 69 % (ln 2, el resultado clásico de Yao), fragmentación ≈ 100 %, casi
  todas las páginas calientes. Ocupa bastante más que identity por la clave de 16 bytes y el aire.
- `int identity` y GUID secuencial estricto: 100 % de llenado en SQL Server (90 % en PostgreSQL),
  sin fragmentación, 15 a 20 páginas calientes.
- GUID v7 de .NET: las páginas calientes son pocas siempre (la parte más importante del beneficio),
  pero como dentro del mismo milisegundo los bits son aleatorios, con varias inserciones por ms las
  claves caen desordenadas en la última página y, en el modelo de SQL Server, fuerzan divisiones a
  la mitad: el llenado baja a 55-70 % y aparece fragmentación. En PostgreSQL el efecto es mucho
  menor. Con una inserción por ms es idéntico al secuencial estricto.

## Qué es y qué no es

Es un modelo para entender el mecanismo, no un benchmark de un motor real. Páginas de 8.192 bytes
con 96 de cabecera y 10 bytes de sobrecarga por fila; las divisiones son 50/50 salvo en el extremo
derecho, donde cada "motor" hace lo suyo. No hay borrados, actualizaciones, reutilización de
espacio, fillfactor configurable, concurrencia ni caché con tamaño. El texto de la página explica
además el orden raro de los `uniqueidentifier` de SQL Server (compara de derecha a izquierda por
grupos de bytes), por qué EF Core acomoda los bytes y qué pasa en PostgreSQL, donde la tabla es un
heap y sufre el índice.

## Cómo se prueba

Lógica (PRNG reproducible, capacidades, generadores, invariantes del B+tree, llenados esperados
por tipo de clave y motor, v7 a distintas tasas, corrida por pasos):

```bash
node --test experimentos/guid-vs-identity/tests/*.test.js
```

Recorrido en Chromium headless a 360 px y 1280 px (corrida inicial, números de la página contra la
lógica en Node, gráficos, segunda corrida con PostgreSQL, controles de 44 px, sin errores):

```bash
node experimentos/guid-vs-identity/tests/e2e.js      # necesita playwright (NODE_PATH si está global)
```

## Qué no se pudo probar

No se contrastó contra un SQL Server o PostgreSQL reales con `sys.dm_db_index_physical_stats` o
`pgstattuple`; los resultados coinciden con lo que publica la bibliografía citada (69 % de llenado
para inserciones al azar, páginas llenas para secuenciales), pero los valores absolutos de
fragmentación y de divisiones dependen del motor y de su asignación de extents.

## Archivos

```
index.html             página, gráficos SVG y texto
logica.js              B+tree, generadores de claves y corridas; se carga en el navegador y en Node
tests/logica.test.js   tests de la lógica
tests/e2e.js           recorrido en Chromium a 360 y 1280 px
```
