# Working Folder Auto

Lo que arma el **Programador nocturno**, una rutina en la nube que corre todas las noches a las 3 AM (hora Argentina): juegos, apps, herramientas, escritos y experimentos.

**Vitrina:** https://fnguerrero.github.io/working-folder-auto/

## Cómo pedirle algo

Con `/noche <qué hacer>` desde Claude Code, o con un issue con la etiqueta `noche` (y `grande` si es de varias noches). Las ideas que deja él tienen la etiqueta `sugerencia`: para que haga una, ponele `noche`.

Trabaja directo sobre `main`. Si algo no te gusta, se mueve a `_archivo/`.

## Proyectos

| Proyecto | Categoría | Qué es | Estado | Probar |
|---|---|---|---|---|
| Simón dice | juegos | Cuatro colores con sonido y una secuencia que crece cada ronda. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/juegos/simon/) |
| Globos | juegos | Reventar globos con el dedo: modo tranqui y desafío de 60 segundos. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/juegos/globos/) |
| JSON a C# | herramientas | Pegás un JSON y salen las clases o records de C# con tipos inferidos; también TypeScript. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/herramientas/json-a-csharp/) |
| Cuotas en curso | apps | Cuánto tenés comprometido en cuotas por mes y cuándo te liberás. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/apps/cuotas-en-curso/) |
| Por qué explota el p99 | experimentos | Simulador de colas para backend: workers, carga y variabilidad contra Erlang C y Little, con diagnóstico. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/experimentos/colas-p99/) |
| Cron en criollo | herramientas | Explica expresiones cron (estándar y Quartz.NET) en castellano, con próximas ejecuciones en hora argentina y snippets de C#. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/herramientas/cron-en-criollo/) |
| Xilofón | juegos | Ocho láminas que suenan con los dedos, con bichos y canciones que se tocan solas. Para Valentín. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/juegos/xilofon/) |
| PostgreSQL para los que vienen de SQL Server | escritos | Guía de 17 capítulos de T-SQL a PostgreSQL desde .NET, con todos los ejemplos ejecutados contra Postgres 16. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/escritos/postgres-desde-sqlserver/) |
| Lo que te corresponde | apps | Liquidación final, aguinaldo y vacaciones según la LCT, con la fórmula de cada concepto y su artículo. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/apps/lo-que-te-corresponde/) |
| GUID o identity | experimentos | Simulador de B+tree que mide qué le pasa al índice con claves int, GUID aleatorios, v7 y secuenciales. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/experimentos/guid-vs-identity/) |
| Plan en criollo | herramientas | Explica un plan de ejecución de SQL Server en castellano: qué pasa, dónde se va el tiempo y qué hacer, con planes reales de ejemplo. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/herramientas/plan-en-criollo/) |
| Índices con el cronómetro en la mano | escritos | Trece experimentos sobre índices de SQL Server, medidos en páginas leídas contra un servidor real, con chuleta y qué cambia en .NET. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/escritos/indices-con-cronometro/) |
| Pecera | juegos | Peces que vienen a comer cuando tocás el agua, con cangrejo, tortuga y burbujas. Para Valentín. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/juegos/pecera/) |
| El thread pool en vivo | experimentos | Simulador del thread pool de .NET: inanición por .Result o I/O sincrónica contra async, contrastado contra un .NET 8 real, con diagnóstico y qué hacer. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/experimentos/thread-pool-en-vivo/) |
| Connection string en criollo | herramientas | Explica una cadena de conexión de SQL Server, PostgreSQL, MySQL o Redis: cada clave, qué es peligroso y dónde guardarla. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/herramientas/connection-string-en-criollo/) |
| Cuánto cuesta cada cosa en .NET 8 | escritos | 129 microbenchmarks de .NET 8 medidos con BenchmarkDotNet: strings, LINQ, excepciones, regex, JSON, async, lock, logging; con el código, la tabla y qué hacer. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/escritos/cuanto-cuesta-dotnet/) |
| Stack trace en criollo | herramientas | Pegás una excepción de .NET y te dice qué pasó, dónde fue en tu código y qué suele significar. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/herramientas/stack-trace-en-criollo/) |
| Asado para cuántos | apps | Cuánto comprar para un asado, a qué hora prender, en qué orden poner los cortes y cuánto pone cada uno. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/apps/asado/) |
| Cohete | juegos | Tocás el cohete y despega hasta la Luna, que sonríe y canta, y vuelve en paracaídas; estrellas que suenan, planetas, ovnis y cometas. Para Valentín. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/juegos/cohete/) |
| EF Core con el cronómetro en la mano | escritos | Trece experimentos sobre lo que EF Core manda al servidor y lo que trae, medidos contra SQL Server: N+1, Include, tracking, paginación, Contains, inserciones, ExecuteUpdate, varchar, planes, async. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/escritos/efcore-con-cronometro/) |
| ¿Cuotas o contado? | apps | Qué tasa esconden las cuotas, cuánto valen en plata de hoy y qué conviene según qué hacés con la plata: rendir, quieta o sueldo. | terminado | [abrir](https://fnguerrero.github.io/working-folder-auto/apps/cuotas-o-contado/) |

Las convenciones de estructura y trabajo están en [CLAUDE.md](CLAUDE.md).
