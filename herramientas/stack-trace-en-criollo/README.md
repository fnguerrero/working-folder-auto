# Stack trace en criollo

Pegás una excepción de .NET tal como salió en el log (con sus `--->`, sus `MoveNext()` y sus
`<>c__DisplayClass`) y te dice en castellano **qué pasó** (la causa probable y qué suele significar),
**dónde fue en tu código** (el primer frame tuyo, con archivo y línea, y desde dónde se lo llamó) y te
muestra la **cadena de excepciones** (externa → internas → causa raíz) y la **traza limpia**, con los
nombres del compilador traducidos (lambdas, async, iteradores, funciones locales, top-level
statements, constructores, propiedades, genéricos) y los frames clasificados en tuyos, librerías,
framework y ruido del runtime. Entiende `AggregateException` con varias internas, trazas de .NET
Framework en español («en … en …:línea»), texto escapado (`\r\n` literales) y JSON de logs (Serilog,
Elastic). Todo corre en el navegador: una traza suele tener rutas, servidores y datos.

**Probar:** https://fnguerrero.github.io/working-folder-auto/herramientas/stack-trace-en-criollo/

**Estado:** terminado.

## Qué hace

- **Diagnóstico** con una base de ~170 reglas de errores típicos de un backend .NET: `NullReference`,
  `ArgumentNull` (y el caso `source` de LINQ, y el `connectionString` null), `InvalidCast` con `DBNull`,
  `Format` con cultura, `InvalidOperation` con sus mensajes (secuencia vacía, colección modificada,
  `Nullable` sin valor, segunda operación sobre el `DbContext`, LINQ no traducible, tracking duplicado,
  DI sin registrar o Scoped desde la raíz, headers ya enviados, I/O sincrónica), `ObjectDisposed` del
  `DbContext`, `TaskCanceled` por `HttpClient.Timeout`, `AggregateException`, `TypeInitialization`,
  ensamblado que falta, archivos y permisos, `System.Drawing` en Linux, modo invariante de
  globalización, `SocketException` por código (rechazada, timeout, DNS, reset), `HttpRequestException`
  por status y por TLS, JSON (STJ y Newtonsoft), `DbUpdateException` y concurrencia de EF Core,
  Dapper (`Error parsing column`), Redis, RabbitMQ, gRPC, JWT, AutoMapper, MediatR, Hangfire, Polly;
  **SQL Server por `Error Number`** (2627/2601, 547, 515, 2628/8152, 208, 207, 2812, 245, 241/242,
  8115, 137, 1205, -2, 18456, 4060, 53/40/26, transporte, 50000, 2714, 3902/3930, 102, 1222, 9002,
  Azure transitorios…) y **PostgreSQL por SQLSTATE** (23505, 23503, 23502, 23514, 22001, 22P02,
  42P01, 42703, 42601, 42883, 40P01, 40001, 57014, 53300, 28P01, 3D000, 42501, P0001, 08006…), más
  los errores del lado de Npgsql (timeout, pool, `DateTime.Kind`).
- **Elige la excepción que explica el problema**, no necesariamente la más interna: un
  `TaskCanceledException` que dice «HttpClient.Timeout» explica más que la `SocketException (125)` de
  cinco niveles más abajo. Cada regla tiene prioridad; a igual prioridad gana la más interna.
- **Dónde**: el primer frame de tu código de esa excepción (o de la que la envuelve, si la causa no pasó
  por tu código), con archivo y línea, y la lista de llamadores tuyos.
- **Avisos** sobre la traza misma: no hay números de línea (faltan los `.pdb`), no hay frames tuyos,
  `.Result`/`.Wait()` (sync sobre async), `lambda_method` (expresión compilada), materializador de Dapper,
  varias internas en una `AggregateException`, interna sin pila propia (SqlClient/Npgsql), traza en
  español, plataforma (.NET Framework o Core), rutas de la máquina de build, varias trazas pegadas.
- **Cadena de excepciones**: tarjetas de afuera hacia adentro, con `HRESULT`, `Error Number`/State/Class,
  SQLSTATE y los datos extra de Npgsql (restricción, tabla), y una mini explicación por cada una.
- **Traza limpia**: por excepción, con filtros «Solo lo tuyo», «Sin ruido del runtime» (saca
  `TaskAwaiter`, `ExceptionDispatchInfo`, `ExecutionContext`, `ThrowHelper`…) y «Todo»; etiquetas
  (tuyo, librería, generado, async, lambda, iterador, función local, constructor…), archivo:línea, el
  frame crudo si lo pedís, y **Copiar en Markdown** para pegar en un issue o un chat.
- **Texto**: cómo se lee una traza, internas, `AggregateException`, tabla de nombres del compilador,
  por qué faltan números de línea, `throw` vs `throw ex`, cómo loguear mejor, qué es y qué no es, fuentes.
- **14 ejemplos**: 12 son trazas reales capturadas esta noche (ver abajo); «Serilog» y «.NET Framework»
  están armados a mano con el formato de cada caso.

## Cómo funciona

- `logica.js`: preparación del texto (JSON, desescapado, saltos pegados), parser por líneas con una
  pila de excepciones (`--->` abre, `--- End of inner exception stack trace ---` cierra,
  `(Inner Exception #n) … <---` para agregadas, `--->` en la misma línea para .NET Framework, reparación
  cuando la interna no tiene pila ni separador), parser de frames (parámetros balanceados, genéricos,
  `+MoveNext()`, implementación explícita de interfaz, archivo:línea en inglés y español), desenmarañado
  de nombres, clasificación de origen y ruido, elección de la causa, «dónde», avisos y Markdown.
- `conocimiento.js`: las reglas (tipo, mensaje, número, SQLSTATE, prioridad, título, qué, qué hacer, fuente).
- `ejemplos.js`: los ejemplos de la página. `index.html` solo pinta.
- `generador/`: proyecto .NET 8 (`Microsoft.NET.Sdk.Web`) que provoca ~170 excepciones reales (ADO.NET,
  EF Core 8, Dapper, Npgsql 8, HttpClient, System.Text.Json, Newtonsoft, Redis, ASP.NET Core, DI, LINQ,
  async, reflexión, archivos) y guarda `ex.ToString()` de cada una. Se corrió en Docker contra un
  SQL Server 2022 y un PostgreSQL 16 reales; las 169 trazas están en `tests/trazas/` y son el corpus
  de los tests.

## Cómo se prueba

```bash
node --test herramientas/stack-trace-en-criollo/tests/logica.test.js
node --check <(sed -n '/^<script>$/,/^<\/script>$/p' herramientas/stack-trace-en-criollo/index.html | sed '1d;$d')
npm i -D playwright && npx playwright install chromium   # una sola vez
node herramientas/stack-trace-en-criollo/tests/e2e.js
```

Los 13 tests de la lógica recorren las 169 trazas reales (todas se parsean con tipo, frames, cada
`line N` reconocido y una regla), y verifican la cadena de internas de EF Core → SqlClient, los cinco
niveles del timeout de HttpClient, la `AggregateException` con `#0` y `#1`, los nombres del compilador
(lambda, función local, iterador, top-level, `..ctor`, `..cctor`, `get_`, genéricos, `lambda_method`,
materializador de Dapper, interfaz explícita, `ref`), texto escapado y JSON de Serilog, .NET Framework en
español con `--->` en la misma línea, ~110 pares traza → regla esperada, los datos extra de Npgsql, los
avisos, el Markdown y las entradas que no son una traza. El e2e corre en Chromium headless a 360×740 y
1280×720: ejemplos, diagnóstico, dónde, cadena, filtros, etiquetas, frame crudo, copiar en Markdown,
JSON de Serilog, .NET Framework en español con rutas completas, texto escapado pegado a mano, texto que no
es una traza, limpiar, ningún pedido a otro dominio, sin errores de consola y sin scroll horizontal.

Para regenerar el corpus (hace falta Docker; las contraseñas van por variables de entorno y no están en el repo):

```bash
docker run -d --name sql --network host -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<una>' mcr.microsoft.com/mssql/server:2022-latest
docker run -d --name pg --network host -e POSTGRES_PASSWORD=noche -e POSTGRES_USER=noche -e POSTGRES_DB=noche postgres:16
cd herramientas/stack-trace-en-criollo/generador
SQL_CS='Server=127.0.0.1,1433;Database=master;User ID=sa;Password=<una>;TrustServerCertificate=True' \
PG_CS='Host=127.0.0.1;Database=noche;Username=noche;Password=noche' dotnet run -c Release -- ../tests/trazas
```

Lo que **no se pudo probar**: trazas de .NET Framework reales (el ejemplo y el test están armados a mano
siguiendo el formato de `Exception.ToString()` de Framework 4.8 en español, con `--->` en la misma línea y
«Fin del seguimiento de la pila»), trazas de Windows con `C:\…` reales (solo las del ejemplo), y las
explicaciones son las causas **habituales** de cada error, no un diagnóstico del caso: el mensaje completo
y el código mandan. Si una excepción no está en las reglas, igual se ve la cadena, los frames tuyos y los
nombres traducidos; el lugar para agregarla es `conocimiento.js`.
