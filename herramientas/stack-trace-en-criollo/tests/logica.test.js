/* Tests de la lógica de «Stack trace en criollo». Correr desde la raíz del repo:
     node --test herramientas/stack-trace-en-criollo/tests/logica.test.js
   El corpus de tests/trazas/ son 169 excepciones reales capturadas en .NET 8 con generador/. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ST = require("../logica.js");

const DIR = path.join(__dirname, "trazas");
const traza = (n) => fs.readFileSync(path.join(DIR, n + ".txt"), "utf8");
const todasLasTrazas = fs.readdirSync(DIR).filter((f) => f.endsWith(".txt")).map((f) => f.replace(/\.txt$/, ""));

test("el corpus entero se parsea: una excepción con tipo, frames, y ninguna línea «at» sin leer", () => {
  assert.ok(todasLasTrazas.length >= 160, `hay ${todasLasTrazas.length} trazas`);
  for (const f of todasLasTrazas) {
    const a = ST.analizar(traza(f));
    assert.ok(a.ok, f);
    assert.ok(a.principal.tipo, `${f}: sin tipo`);
    assert.ok(a.frames.some((x) => !x.marcador), `${f}: sin frames`);
    assert.equal(a.resultado.noReconocidas, 0, `${f}: líneas at sin leer`);
    assert.ok(a.causa && a.causa.regla, `${f}: sin regla`);
    // Cada frame con «in …:line N» quedó con archivo y línea.
    const conLinea = (traza(f).match(/:line \d+/g) || []).length;
    assert.equal(a.frames.filter((x) => x.linea).length, conLinea, `${f}: números de línea`);
  }
});

test("cadena de internas: DbUpdateException → SqlException 2627, con Error Number y causa correcta", () => {
  const a = ST.analizar(traza("ef-duplicate"));
  assert.deepEqual(a.cadena.map((e) => e.corto), ["DbUpdateException", "SqlException"]);
  assert.equal(a.cadena[1].extras["Error Number"], "2627");
  assert.equal(ST.numeroSql(a.cadena[1]), 2627);
  assert.equal(a.causa.regla.id, "sql-2627");
  assert.match(a.resumen, /DbUpdateException que envuelve una SqlException 2627/);
  // Los frames de la interna son los de SqlClient; los de la externa, los de EF.
  assert.match(a.cadena[1].frames[0].crudo, /^Microsoft\.Data\.SqlClient/);
  assert.match(a.cadena[0].frames[0].crudo, /^Microsoft\.EntityFrameworkCore/);
  assert.equal(a.donde.frame.linea, 192);
});

test("cinco niveles de internas (timeout de HttpClient) y la causa no es la más interna", () => {
  const a = ST.analizar(traza("http-timeout"));
  assert.deepEqual(a.cadena.map((e) => e.corto), ["TaskCanceledException", "TimeoutException", "TaskCanceledException", "IOException", "SocketException"]);
  assert.equal(a.causa.regla.id, "taskcanceled-http");
  assert.equal(a.causa.ex, a.cadena[0]);
  assert.ok(a.avisos.some((x) => /no es de la más interna/.test(x.titulo)));
});

test("AggregateException con dos internas (#0 y #1) y aviso de sync sobre async", () => {
  const a = ST.analizar(traza("whenall-wait"));
  assert.equal(a.principal.corto, "AggregateException");
  assert.equal(a.principal.internas.length, 2);
  assert.deepEqual(a.principal.internas.map((e) => e.corto).sort(), ["InvalidOperationException", "TimeoutException"]);
  assert.equal(a.principal.internas[1].indiceAgregada, 1);
  assert.ok(a.principal.internas.every((e) => e.frames.filter((f) => !f.marcador).length >= 3));
  assert.ok(a.avisos.some((x) => /Sync sobre async/.test(x.titulo)));
  assert.ok(a.avisos.some((x) => /2 excepciones internas/.test(x.titulo)));
  const b = ST.analizar(traza("result-aggregate"));
  assert.ok(b.avisos.some((x) => /Sync sobre async/.test(x.titulo)));
  assert.equal(b.donde.frame.metodo, "LeerFilaAsync");
});

test("nombres del compilador: lambda, función local, iterador, top-level, constructor, genéricos", () => {
  const f = (s) => ST.parsearFrame(s);
  let x = f("Tienda.Api.Importador.<>c.<ParsearEdades>b__0_0(String f) in /src/Program.cs:line 304");
  assert.equal(x.clase, "Importador"); assert.equal(x.namespace, "Tienda.Api"); assert.ok(x.etiquetas.includes("lambda")); assert.equal(x.metodoDe, "ParsearEdades");
  assert.equal(ST.nombreFrame(x), "Importador.λ dentro de ParsearEdades(string f)"); assert.equal(x.linea, 304); assert.equal(x.origen, "tuyo");
  x = f("Tienda.Api.Importador.<ValidarTodo>g__Validar|1_0(String f)");
  assert.ok(x.etiquetas.includes("función local")); assert.equal(x.metodo, "Validar"); assert.equal(x.metodoDe, "ValidarTodo");
  x = f("Tienda.Api.Importador.Leer(IEnumerable`1 filas)+MoveNext()");
  assert.ok(x.etiquetas.includes("iterador")); assert.equal(x.metodo, "Leer"); assert.equal(x.parametros[0].tipo, "IEnumerable<T>");
  x = f("Program.<Main>$(String[] args) in /w/Program.cs:line 253");
  assert.equal(x.metodo, "Main"); assert.ok(x.etiquetas.includes("top-level")); assert.equal(x.origen, "tuyo");
  x = f("Program.<>c__DisplayClass0_1.<<Main>$>b__122()");
  assert.ok(x.etiquetas.includes("lambda")); assert.equal(x.metodoDe, "Main"); assert.equal(x.origen, "tuyo"); assert.equal(x.clase, "Program");
  x = f("Program.<>c.<<<Main>$>b__0_5>d.MoveNext() in /w/Program.cs:line 40");
  assert.ok(x.etiquetas.includes("async")); assert.ok(x.etiquetas.includes("lambda")); assert.equal(x.origen, "tuyo");
  x = f("Tienda.Web.Servicios.ReportesService.<ArmarResumenAsync>d__4.MoveNext()");
  assert.equal(x.metodo, "ArmarResumenAsync"); assert.ok(x.etiquetas.includes("async")); assert.equal(x.clase, "ReportesService");
  assert.equal(ST.nombreFrame(x), "ReportesService.async ArmarResumenAsync()");
  x = f("System.Collections.Generic.List`1..ctor(IEnumerable`1 collection)");
  assert.equal(x.clase, "List<T>"); assert.ok(x.etiquetas.includes("constructor")); assert.equal(ST.nombreFrame(x), "new List<T>(IEnumerable<T> collection)"); assert.equal(x.origen, "framework");
  x = f("Tienda.Api.Configuracion..cctor() in /w/Program.cs:line 289");
  assert.ok(x.etiquetas.includes("constructor estático")); assert.equal(ST.nombreFrame(x), "static Configuracion()");
  x = f("System.Linq.Enumerable.ToList[TSource](IEnumerable`1 source)");
  assert.equal(x.metodo, "ToList<TSource>");
  x = f("Tienda.Api.Factura.get_Total() in /w/Program.cs:line 286");
  assert.equal(x.metodo, "Total"); assert.ok(x.etiquetas.includes("propiedad (get)"));
  x = f("lambda_method8(Closure, Object, HttpContext)");
  assert.equal(x.origen, "generado"); assert.ok(x.etiquetas.includes("expresión compilada"));
  x = f("Deserialize1cfac4ff-d4e5-4eac-a571-26ca8b189f3c(DbDataReader)");
  assert.equal(x.origen, "generado"); assert.ok(x.etiquetas.includes("Dapper"));
  x = f("System.Net.Sockets.Socket.AwaitableSocketAsyncEventArgs.System.Threading.Tasks.Sources.IValueTaskSource<System.Int32>.GetResult(Int16 token)");
  assert.equal(x.clase, "AwaitableSocketAsyncEventArgs"); assert.equal(x.metodo, "IValueTaskSource<System.Int32>.GetResult"); assert.equal(x.parametros[0].tipo, "short");
  x = f("Microsoft.Data.SqlClient.TdsParser.TryRun(RunBehavior runBehavior, SqlCommand cmdHandler, Boolean& dataReady)");
  assert.equal(x.parametros[2].tipo, "ref bool"); assert.equal(x.libreria, "SqlClient"); assert.equal(x.origen, "framework");
  x = f("Dapper.SqlMapper.QueryImpl[T](IDbConnection cnn, CommandDefinition command, Type effectiveType)+MoveNext()");
  assert.equal(x.origen, "libreria"); assert.equal(x.libreria, "Dapper"); assert.ok(x.etiquetas.includes("iterador"));
  x = f("System.Runtime.ExceptionServices.ExceptionDispatchInfo.Throw()");
  assert.ok(x.ruido);
});

test("texto escapado, JSON de Serilog y prefijo «Unhandled exception.»", () => {
  const original = traza("http-refused");
  const escapado = original.replace(/\n/g, "\\r\\n").replace(/"/g, "\\\"");
  const a = ST.analizar(escapado);
  assert.ok(a.ok); assert.deepEqual(a.resultado.notas, ["escapado"]);
  assert.deepEqual(a.cadena.map((e) => e.corto), ["HttpRequestException", "SocketException"]);
  assert.equal(a.causa.regla.id, "socket-rechazada");
  const json = JSON.stringify({ "@t": "2026-10-16T06:12:44Z", "@mt": "Falló {PedidoId}", "@l": "Error", "@x": original, PedidoId: 1 });
  const b = ST.analizar(json);
  assert.ok(b.ok); assert.ok(b.resultado.notas.includes("json"));
  assert.equal(b.frames.filter((f) => !f.marcador).length, a.frames.filter((f) => !f.marcador).length);
  const c = ST.analizar("Unhandled exception. " + traza("nullref-sync"));
  assert.equal(c.principal.corto, "NullReferenceException");
  assert.equal(c.causa.regla.id, "nullref");
  assert.equal(c.donde.frame.metodo, "ArmarSaludo");
});

test(".NET Framework en español: «en … en …:línea», ---> en la misma línea, Win32Exception sin pila, Fin del seguimiento", () => {
  const texto = [
    "System.Data.SqlClient.SqlException (0x80131904): Tiempo de espera agotado. ---> System.ComponentModel.Win32Exception (0x80004005): El tiempo de espera se agotó",
    "   --- Fin del seguimiento de la pila de la excepción interna ---",
    "   en System.Data.SqlClient.SqlConnection.OnError(SqlException exception, Boolean breakConnection, Action`1 wrapCloseInAction)",
    "   en Dapper.SqlMapper.<QueryImpl>d__140`1.MoveNext() en C:\\projects\\dapper\\Dapper\\SqlMapper.cs:línea 1101",
    "   en Tienda.Web.Datos.PedidosRepositorio.Listar(Int32 clienteId) en C:\\Proyectos\\Tienda\\Datos\\PedidosRepositorio.cs:línea 58",
    "   en Tienda.Web.Servicios.ReportesService.<ArmarResumenAsync>d__4.MoveNext() en C:\\Proyectos\\Tienda\\Servicios\\ReportesService.cs:línea 41",
    "--- Fin del seguimiento de la pila de la ubicación anterior donde se produjo la excepción ---",
    "   en System.Runtime.ExceptionServices.ExceptionDispatchInfo.Throw()",
    "   en Tienda.Web.Controllers.ReportesController.<Resumen>d__2.MoveNext() en C:\\Proyectos\\Tienda\\Controllers\\ReportesController.cs:línea 31",
    "ClientConnectionId:9f1c2a66-4b1e-4e6b-9c3e-2d8f0a1b7c55",
    "Error Number:-2,State:0,Class:11",
  ].join("\r\n");
  const a = ST.analizar(texto);
  assert.equal(a.resultado.idioma, "es");
  assert.deepEqual(a.cadena.map((e) => e.corto), ["SqlException", "Win32Exception"]);
  assert.equal(a.cadena[0].mensaje, "Tiempo de espera agotado.");
  assert.equal(a.cadena[1].frames.length, 0);
  assert.equal(a.cadena[0].frames.filter((f) => !f.marcador).length, 6);
  assert.equal(a.cadena[0].extras["Error Number"], "-2");
  assert.equal(a.causa.regla.id, "sql--2");
  assert.equal(a.donde.frame.linea, 58); assert.equal(a.donde.frame.archivo, "C:\\Proyectos\\Tienda\\Datos\\PedidosRepositorio.cs");
  assert.deepEqual(a.llamadores.map((f) => f.metodo), ["Listar", "ArmarResumenAsync", "Resumen"]);
  assert.ok(a.frames.some((f) => f.marcador === "anterior"));
  assert.ok(a.avisos.some((x) => /Traza en español/.test(x.titulo)));
  assert.ok(a.avisos.some((x) => /\.NET Framework/.test(x.texto)));
});

test("reglas: SQL Server por número, Postgres por SQLSTATE, EF, Dapper, DI, JSON, archivos, red", () => {
  const casos = {
    "sql-deadlock": "sql-1205", "sql-timeout": "sql--2", "sql-fk": "sql-547", "sql-null-insert": "sql-515", "sql-truncate": "sql-2628",
    "sql-invalid-object": "sql-208", "sql-invalid-column": "sql-207", "sql-conversion": "sql-245", "sql-login-failed": "sql-18456",
    "sql-db-missing": "sql-4060", "sql-network": "sql-53", "sql-param-missing": "sql-137", "sql-check": "sql-547", "sql-proc-missing": "sql-2812",
    "sql-arithmetic-overflow": "sql-8115", "sql-divide-zero": "sql-8134", "sql-pool-exhausted": "sql-pool", "sql-mars": "sql-mars",
    "sql-reader-dbnull": "invalidcast-dbnull", "sql-reader-getstring": "sqlnull", "sql-reader-column": "indexout-reader", "sql-reader-getint-wrong": "invalidcast-reader",
    "sql-connection-closed": "sql-cerrada", "sql-reader-closed": "sql-reader-cerrado", "sql-transaction-zombie": "sql-tx-zombie", "sql-command-no-tx": "sql-tx-zombie",
    "pg-duplicate-key": "pg-23505", "pg-fk": "pg-23503", "pg-null": "pg-23502", "pg-deadlock": "pg-40P01", "pg-statement-timeout": "pg-57014", "pg-command-timeout": "npgsql-timeout",
    "pg-column-missing": "pg-42703", "pg-invalid-int": "pg-22P02", "pg-truncate": "pg-22001", "pg-check": "pg-23514", "pg-db-missing": "pg-3D000", "pg-syntax": "pg-42601",
    "pg-raise": "pg-P0001", "pg-too-many-connections": "npgsql", "pg-refused": "socket-rechazada",
    "ef-duplicate": "sql-2627", "ef-concurrency": "concurrencia", "ef-concurrency-deleted": "sql-547", "ef-not-translated": "ef-no-traducida",
    "ef-disposed": "ef-disposed", "ef-second-operation": "ef-segunda-op", "ef-tracking-duplicate": "ef-tracking", "ef-no-provider": "ef-sin-proveedor",
    "ef-first-empty": "linq-vacio", "ef-single-many": "linq-varios", "ef-invalid-column-model": "sql-207", "ef-timeout": "sql--2", "ef-deadlock": "sql-1205", "ef-lazy-no-config": "nullref",
    "dapper-cast": "dapper", "dapper-single": "linq-vacio", "dapper-single-many": "linq-varios", "dapper-async-timeout": "sql--2", "sql-param-missing-dapper": "sql-137",
    "di-unresolved": "di-sin-registrar", "di-scoped-from-root": "di-scoped-raiz", "di-no-registered": "di-no-service",
    "stj-type": "json-stj", "stj-malformed": "json-stj", "stj-cycle": "json-ciclo", "newtonsoft-type": "json-newtonsoft-reader", "newtonsoft-malformed": "json-newtonsoft-reader", "aspnet-badrequest-json": "json-stj",
    "http-timeout": "taskcanceled-http", "http-refused": "socket-rechazada", "http-status-500": "http-status", "http-status-404": "http-status", "http-cancel": "taskcanceled", "redis-refused": "redis-conexion",
    "file-not-found": "carpeta", "directory-not-found": "carpeta", "unauthorized-access": "io", "file-in-use": "archivo-en-uso", "missing-assembly": "ensamblado", "missing-method": "missingmethod",
    "nullref-sync": "nullref", "linq-null-source": "argnull-source", "collection-modified": "coleccion-modificada", "nullable-novalue": "nullable-sinvalor", "linq-first": "linq-vacio",
    "format-int": "format-num", "format-date": "format-date", "dict-key": "keynotfound", "list-index": "argout", "type-init": "typeinit", "drawing-linux": "drawing",
    "culture-invariant-sqlclient": "invariante", "out-of-memory-array": "oom", "validation-exception": "argumento", "semaphore-full": "semaforo",
    "custom-exception": "propia", "parallel-foreach": "invalidop", "target-invocation": "argumento", "win32-process": "win32", "socket-refused": "socket-rechazada",
  };
  for (const [archivo, id] of Object.entries(casos)) {
    const a = ST.analizar(traza(archivo));
    assert.equal(a.causa.regla.id, id, `${archivo}: esperaba ${id}, salió ${a.causa.regla.id} (${a.cadena.map((e) => e.corto).join(" > ")})`);
  }
});

test("interna sin pila y sin separador (SqlClient, Npgsql): los frames y el Error Number van a la externa", () => {
  const a = ST.analizar(traza("sql-timeout"));
  assert.deepEqual(a.cadena.map((e) => e.corto), ["SqlException", "Win32Exception"]);
  assert.ok(a.cadena[0].frames.length >= 5); assert.equal(a.cadena[1].frames.length, 0);
  assert.equal(a.cadena[0].extras["Error Number"], "-2");
  assert.equal(a.causa.regla.id, "sql--2");
  assert.ok(a.avisos.some((x) => /Interna sin pila propia/.test(x.titulo)));
  const b = ST.analizar(traza("pg-refused"));
  assert.equal(b.principal.corto, "NpgsqlException");
  assert.ok(b.principal.frames.length >= 3);
});

test("datos extra de Npgsql (Exception data) y de FileNotFound (File name) quedan en extras", () => {
  const a = ST.analizar(traza("pg-fk"));
  assert.equal(a.principal.extras.SqlState, "23503");
  assert.equal(a.principal.extras.ConstraintName, "pedidos_cliente_id_fkey");
  assert.equal(a.principal.extras.TableName, "pedidos");
  assert.equal(ST.sqlState(a.principal), "23503");
  const b = ST.analizar(traza("missing-assembly"));
  assert.match(b.principal.mensaje, /Could not load file or assembly/);
  assert.match(b.principal.mensaje, /File name: 'Tienda\.Comun/);
});

test("avisos: sin números de línea, sin frames tuyos, lambda_method, varias trazas pegadas", () => {
  const sinPdb = traza("nullref-sync").replace(/ in \/w\/Generador\/Program\.cs:line \d+/g, "");
  const a = ST.analizar(sinPdb);
  assert.ok(a.avisos.some((x) => /no tienen archivo ni número de línea/.test(x.titulo)));
  assert.equal(a.donde.frame.archivo, null);
  const b = ST.analizar(traza("aspnet-nullref"));
  assert.equal(b.causa.regla.id, "nullref");
  assert.equal(b.donde, null);
  assert.ok(b.avisos.some((x) => /lambda_method/.test(x.titulo)));
  assert.ok(b.avisos.some((x) => /No hay ningún frame de tu código/.test(x.titulo)));
  const c = ST.analizar(traza("local-function") + "\n\n" + traza("lambda-linq"));
  assert.equal(c.resultado.raices.length, 2);
  assert.equal(c.otrasRaices[0].corto, "FormatException");
  assert.ok(c.avisos.some((x) => /2 excepciones independientes/.test(x.titulo)));
});

test("Markdown: resumen, causa, dónde y frames según el filtro", () => {
  const a = ST.analizar(traza("ef-duplicate"));
  const md = ST.aMarkdown(a, "tuyos");
  assert.match(md, /^\*\*Una DbUpdateException que envuelve una SqlException 2627/);
  assert.match(md, /Causa probable: Clave duplicada/);
  assert.match(md, /- \*\*Microsoft\.EntityFrameworkCore\.DbUpdateException\*\*: An error occurred/);
  assert.match(md, /  - \*\*Microsoft\.Data\.SqlClient\.SqlException\*\*: Violation of PRIMARY KEY/);
  assert.match(md, /\*\*Program\.λ dentro de Main\(\)\*\* · Program\.cs:192/);
  assert.match(md, /frames del framework omitidos/);
  assert.ok(!/TdsParser/.test(md));
  assert.ok(/TdsParser/.test(ST.aMarkdown(a, "todo")));
});

test("lo que no es una traza no rompe", () => {
  assert.equal(ST.analizar("hola, qué tal").ok, false);
  assert.equal(ST.analizar("").ok, false);
  assert.equal(ST.analizar("{\"a\": 1}").ok, false);
  const soloFrames = ST.analizar("   at Tienda.Api.Foo.Bar() in /src/Foo.cs:line 3\n   at Program.Main()");
  assert.ok(soloFrames.ok);
  assert.equal(soloFrames.principal.tipo, "");
  assert.equal(soloFrames.donde.frame.linea, 3);
  const java = ST.analizar("java.lang.NullPointerException: x\n\tat com.acme.Foo.bar(Foo.java:12)");
  assert.ok(java.ok && java.resultado.noReconocidas >= 0);
});
