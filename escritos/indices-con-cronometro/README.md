# Índices con el cronómetro en la mano

Trece capítulos sobre índices de SQL Server, cada uno con un experimento medido contra un servidor
real: páginas y niveles del índice, heap vs. agrupado (RID vs. Key Lookup), clave agrupada ancha,
selectividad y punto de inflexión (con FORCESEEK/FORCESCAN), índice cubriente, orden de las columnas,
sargabilidad (funciones, `CAST`, conversión implícita varchar/nvarchar, `LIKE`), `ORDER BY`/`TOP` y
paginación por clave vs. `OFFSET`, índices filtrados y la trampa de los parámetros
(`UnmatchedIndexes`), estadísticas con histograma y el efecto de literal/variable/parámetro
(parameter sniffing), el costo de escribir con 0 y con 5 índices, columnstore, y las DMV de uso e
índices faltantes. Cierra con una chuleta y qué cambia en el código .NET. Escrito para alguien que
programa en .NET y quiere entender qué pasa del lado del servidor.

**Leer:** https://fnguerrero.github.io/working-folder-auto/escritos/indices-con-cronometro/

**Estado:** terminado.

## Qué lo distingue

**Todos los números son medidos, no inventados.** Se levantó SQL Server 2022 (Developer, Linux, 4 CPU)
con una base «Tienda» (400.000 pedidos, 1,2 millones de ítems, 50.000 clientes, un mayorista con
100.000 pedidos) y cada consulta se corrió con `SET STATISTICS XML ON`; del plan real salen las
lecturas lógicas, el tiempo y la forma del plan. Los tamaños vienen de `sys.dm_db_partition_stats` y
`sys.dm_db_index_physical_stats`, el histograma de `DBCC SHOW_STATISTICS`. Está todo en
`resultados.json` tal cual salió, y `experimentos.sql` tiene el script completo (incluida la carga de
datos) para repetirlo en cualquier SQL Server.

Se mide en páginas leídas y no en segundos, y el texto explica por qué.

## Decisiones

- Una sola página HTML sin dependencias, mismo esqueleto que la guía de PostgreSQL: índice lateral fijo
  en escritorio y desplegable en el celular, modo oscuro, botón de copiar en cada bloque, tablas con
  scroll propio, cuadro «Qué me llevo» al final de cada capítulo.
- Cada capítulo crea sus índices y los borra al final, así los experimentos son independientes y
  reproducibles en cualquier orden (salvo el 8, que usa el índice sobre `Fecha` del 7).
- Las consultas medidas se corren dos veces y se anota la segunda (caché caliente). Los tiempos se
  presentan con la salvedad de que son de un contenedor sin carga.
- Cuando el resultado contradice la intuición se dice: el RID Lookup es más barato que el Key Lookup,
  `CAST(Fecha AS date)` sí hace seek (pero estima mal), el columnstore en 1,2 M de filas solo da 2,4×.

## Cómo se prueba

Coherencia entre el texto y los datos: `tests/datos.test.js` carga `resultados.json` y verifica que
las cifras clave de cada capítulo (lecturas, tiempos, páginas, estimaciones) aparezcan en el HTML con
el formato argentino, y que el SQL de los experimentos esté en `experimentos.sql`:

```bash
node --test escritos/indices-con-cronometro/tests/*.test.js
```

Recorrido en Chromium headless a 360 px y 1280 px (índice generado, navegación, resaltado de la
sección activa, copiar, modo oscuro, sin scroll horizontal ni errores de consola):

```bash
npm i -D playwright && npx playwright install chromium   # una sola vez
node escritos/indices-con-cronometro/tests/e2e.js
```

Lo que **no se pudo probar**: los mismos experimentos en Windows o en una instancia con carga real, y
cómo escalan los resultados del columnstore con decenas de millones de filas (se dice en el texto que
el experimento es chico).

## Archivos

```
index.html         el escrito
experimentos.sql   todos los experimentos y la carga de la base de ejemplo
resultados.json    lo que midió el servidor, tal cual
tests/             datos.test.js (node --test) y e2e.js (Playwright)
```
