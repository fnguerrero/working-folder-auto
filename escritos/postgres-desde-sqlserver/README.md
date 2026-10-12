# PostgreSQL para los que vienen de SQL Server

Una guía de 17 capítulos para pasar de T-SQL y SSMS a PostgreSQL desde .NET: qué cambia de nombre,
qué cambia de verdad y qué muerde si no se sabe. Compara lado a lado SQL Server y PostgreSQL en los
temas de todos los días (nombres y mayúsculas, tipos, identidad y `RETURNING`, consultas, fechas y
zonas horarias con Npgsql, `NULL` y unicidad, PL/pgSQL, MVCC y bloqueos, índices y `EXPLAIN`,
`VACUUM`, `jsonb`, paginación y texto libre, roles, `psql` y backups, Npgsql + EF Core) y cierra con una
chuleta T-SQL → PostgreSQL y las diez sorpresas en orden de aparición.

**Leer:** https://fnguerrero.github.io/working-folder-auto/escritos/postgres-desde-sqlserver/

**Estado:** terminado.

## Qué la distingue

**Todos los bloques marcados "PostgreSQL" se extraen de la página y se ejecutan, en orden, contra un
PostgreSQL 16 real** antes de publicarse. Las líneas `-- →` del texto son la salida que se obtuvo. Si la
guía dice que `7 / 2` da `3`, que los `NULL` van al final o que `date_trunc` sobre un `timestamptz` no se
puede indexar sin fijar la zona, es porque el servidor lo dijo. Los bloques de SQL Server son de
referencia: no hay SQL Server en la nube donde corre esto.

## Decisiones

- Una sola página HTML sin dependencias, con índice lateral en escritorio y desplegable en el celular,
  modo oscuro por `prefers-color-scheme`, botón de copiar en cada bloque y tablas con scroll propio.
- El texto está escrito para alguien que ya sabe SQL: no explica qué es un índice, explica en qué se
  diferencia el de Postgres. Prioriza las trampas (mayúsculas, `timestamptz`, transacción abortada,
  `NULL` en `UNIQUE`, `now()`, precisión de fechas, `VACUUM`) sobre la enumeración de funciones.
- Las versiones de referencia son PostgreSQL 16, Npgsql 8/9 y EF Core 8/9. Donde Postgres 17 o 18
  cambian algo (funciones SQL/JSON, `uuidv7()`), se dice.
- Los bloques que muestran un error a propósito (el del `SAVEPOINT`) llevan `data-error-esperado` y el
  script los corre sin cortar; el resto exige cero errores.

## Cómo se prueba

Ejecutar los bloques de PostgreSQL contra una base donde puedas crear esquemas y roles (crea y borra
el esquema `guia` y los roles `lectores` y `app_ventas`):

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres PGDATABASE=postgres \
  node escritos/postgres-desde-sqlserver/tests/correr-sql.js --guardar
# --guardar deja tests/extraido.sql y tests/salida.txt para revisar la salida a mano
```

La página, en Chromium headless a 360 px y 1280 px (índice, navegación, sección activa, copiar, sin
scroll horizontal, sin errores de consola):

```bash
npm i -D playwright && npx playwright install chromium   # una sola vez
node escritos/postgres-desde-sqlserver/tests/e2e.js
```

Lo que **no se pudo probar**: los bloques de T-SQL (no hay SQL Server disponible) y el código C# de
Npgsql y EF Core (no hay `dotnet` en la nube); ese código sigue la documentación oficial de Npgsql y del
proveedor de EF Core, y está marcado como referencia.

## Archivos

```
index.html            la guía completa, con el índice y el script de la página
tests/correr-sql.js   extrae los bloques PostgreSQL de index.html y los corre con psql
tests/e2e.js          prueba de la página con Playwright
```
