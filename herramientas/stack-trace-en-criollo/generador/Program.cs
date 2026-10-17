// Generador de trazas reales para «Stack trace en criollo».
// Provoca excepciones típicas de un backend .NET 8 y guarda ex.ToString() de cada una en trazas/<caso>.txt.
// Conexiones por variable de entorno: SQL_CS (SQL Server), PG_CS (PostgreSQL). Sin ellas, los casos de base se saltean.
using System.Collections.Concurrent;
using System.Data;
using System.Globalization;
using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tienda.Api;
using Tienda.Api.Datos;
using Tienda.Api.Servicios;

var salida = Path.GetFullPath(args.Length > 0 ? args[0] : "trazas");
Directory.CreateDirectory(salida);
var sqlCs = Environment.GetEnvironmentVariable("SQL_CS");
var pgCs = Environment.GetEnvironmentVariable("PG_CS");
var casos = new List<(string nombre, Func<Task> correr)>();
void Caso(string nombre, Action a) => casos.Add((nombre, () => { a(); return Task.CompletedTask; }));
void CasoAsync(string nombre, Func<Task> f) => casos.Add((nombre, f));

// Servidor web local para los casos de HTTP y de ASP.NET Core.
var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = Array.Empty<string>(), EnvironmentName = "Development" });
builder.Logging.ClearProviders();
var capturador = new CapturadorDeExcepciones();
builder.Logging.AddProvider(capturador);
builder.WebHost.UseUrls("http://127.0.0.1:5088");
builder.Services.AddScoped<ServicioPedidos>();
builder.Services.AddScoped<IRepositorioPedidos, RepositorioPedidos>();
var app = builder.Build();
app.UseExceptionHandler(_ => { });
app.MapGet("/lento", async () => { await Task.Delay(3000); return "tarde"; });
app.MapGet("/error500", () => Results.StatusCode(500));
app.MapGet("/pedidos/{id:int}", async (int id, ServicioPedidos servicio) => await servicio.ObtenerAsync(id));
app.MapGet("/clientes/{id:int}", (int id) => { Cliente? c = null; return c!.Nombre.ToUpper(); });
app.MapPost("/pedidos", (Pedido p) => Results.Ok(p));
await app.StartAsync();

// ---- Casos ----
Caso("nullref-sync", () => new ServicioClientes(new RepositorioClientes()).ArmarSaludo(7));
CasoAsync("async-chain", () => new ServicioPedidos(new RepositorioPedidos()).ObtenerAsync(99));
Caso("result-aggregate", () => _ = new ServicioPedidos(new RepositorioPedidos()).ObtenerAsync(99).Result);
Caso("wait-getawaiter", () => new ServicioPedidos(new RepositorioPedidos()).ObtenerAsync(99).GetAwaiter().GetResult());
Caso("lambda-linq", () => Importador.ParsearEdades(new[] { "33", "abc", "41" }));
Caso("local-function", () => Importador.ValidarTodo(new[] { "ok", "" }));
Caso("iterator", () => Importador.Leer(new[] { "1", "x" }).ToList());
Caso("dict-key", () => { var d = new Dictionary<string, int> { ["ARS"] = 1 }; _ = d["USD"]; });
Caso("list-index", () => { var l = new List<int> { 1, 2 }; _ = l[5]; });
Caso("array-index", () => { var a = new int[2]; a[2] = 1; });
Caso("linq-first", () => _ = new List<int>().First());
Caso("linq-single", () => _ = new[] { 1, 2 }.Single());
Caso("linq-null-source", () => { IEnumerable<int>? xs = null; _ = xs!.Where(x => x > 1).ToList(); });
Caso("collection-modified", () => { var l = new List<int> { 1, 2, 3 }; foreach (var x in l) if (x == 2) l.Remove(x); });
Caso("nullable-novalue", () => { int? n = null; _ = n.Value; });
Caso("format-int", () => _ = int.Parse("abc"));
Caso("format-decimal-coma", () => _ = decimal.Parse("1,5", CultureInfo.InvariantCulture) + decimal.Parse("12.345,67", new CultureInfo("en-US")));
Caso("format-date", () => _ = DateTime.Parse("31/02/2026", new CultureInfo("es-AR")));
Caso("format-guid", () => _ = Guid.Parse("no-es-un-guid"));
Caso("overflow", () => { checked { int x = int.MaxValue; x += 1; } });
Caso("divide-zero", () => { int cero = int.Parse("0"); _ = 10 / cero; });
Caso("invalid-cast", () => { object o = "texto"; _ = (int)o; });
Caso("invalid-cast-enum", () => { object o = 3L; _ = (int)o; });
Caso("argument-null", () => { Pedido? pedido = null; ArgumentNullException.ThrowIfNull(pedido); });
Caso("argument-range", () => _ = "hola".Substring(10));
Caso("argument-exception-thrown", () => Validador.Validar(-5));
Caso("not-implemented", () => Validador.Pendiente());
Caso("not-supported", () => { var ro = Array.AsReadOnly(new[] { 1 }); ((IList<int>)ro).Add(2); });
Caso("object-disposed", () => { var ms = new MemoryStream(); ms.Dispose(); ms.WriteByte(1); });
Caso("timeout-exception", () => { var t = new TaskCompletionSource(); t.Task.Wait(TimeSpan.FromMilliseconds(10)); if (!t.Task.IsCompleted) throw new TimeoutException("La operación no terminó en 10 ms."); });
Caso("operation-canceled", () => { using var cts = new CancellationTokenSource(); cts.Cancel(); cts.Token.ThrowIfCancellationRequested(); });
CasoAsync("task-canceled-delay", async () => { using var cts = new CancellationTokenSource(50); await Task.Delay(5000, cts.Token); });
Caso("type-init", () => _ = Configuracion.Valor);
Caso("static-ctor-chain", () => _ = Configuracion.Valor);
Caso("file-not-found", () => File.ReadAllText("/app/config/appsettings.Produccion.json"));
Caso("directory-not-found", () => File.WriteAllText("/var/log/tienda/no-existe/app.log", "x"));
Caso("unauthorized-access", () => File.WriteAllText("/proc/version", "x"));
Caso("file-in-use", () => { var p = Path.GetTempFileName(); using var a = new FileStream(p, FileMode.Open, FileAccess.ReadWrite, FileShare.None); using var b = new FileStream(p, FileMode.Open, FileAccess.ReadWrite, FileShare.None); });
Caso("missing-assembly", () => Assembly.Load("Tienda.Comun, Version=2.1.0.0, Culture=neutral, PublicKeyToken=null"));
Caso("missing-method", () => Activator.CreateInstance(typeof(Cliente), "nombre", 3));
Caso("target-invocation", () => typeof(Validador).GetMethod(nameof(Validador.Validar))!.Invoke(null, new object[] { -1 }));
Caso("stj-type", () => JsonSerializer.Deserialize<Cliente>("""{"Id":"siete","Nombre":"Ana"}"""));
Caso("stj-malformed", () => JsonSerializer.Deserialize<Cliente>("""{"id":7,"nombre":"Ana",}"""));
Caso("stj-truncated", () => JsonSerializer.Deserialize<Cliente>("""{"id":7,"nombre":"An"""));
Caso("stj-null-value-type", () => JsonSerializer.Deserialize<Cliente>("""{"Id":null,"Nombre":"Ana"}"""));
Caso("newtonsoft-type", () => Newtonsoft.Json.JsonConvert.DeserializeObject<Cliente>("""{"id":"siete","nombre":"Ana"}"""));
Caso("newtonsoft-malformed", () => Newtonsoft.Json.JsonConvert.DeserializeObject<Cliente>("""{"id":7 "nombre":"Ana"}"""));
Caso("newtonsoft-selfreference", () => { var n = new Nodo(); n.Padre = n; Newtonsoft.Json.JsonConvert.SerializeObject(n); });
Caso("stj-cycle", () => { var n = new Nodo(); n.Padre = n; JsonSerializer.Serialize(n); });
Caso("compiled-expression", () => { Expression<Func<Cliente, string>> e = c => c.Nombre.ToUpper(); e.Compile()(new Cliente { Id = 1, Nombre = null! }); });
Caso("parallel-foreach", () => Parallel.ForEach(new[] { 1, 2, 3 }, i => { if (i == 2) throw new InvalidOperationException($"Falló el ítem {i}"); }));
Caso("whenall-wait", () => Task.WhenAll(Task.Run(() => throw new InvalidOperationException("Falló A")), Task.Run(() => throw new TimeoutException("Falló B"))).Wait());
CasoAsync("whenall-await", () => Task.WhenAll(Task.Run(() => throw new InvalidOperationException("Falló A")), Task.Run(() => throw new TimeoutException("Falló B"))));
Caso("out-of-memory", () => _ = new byte[int.MaxValue - 1][].Select(_ => new byte[int.MaxValue - 56]).ToArray());
Caso("out-of-memory-array", () => _ = new long[int.MaxValue]);
Caso("culture-not-found", () => _ = new CultureInfo("no_existe"));
Caso("drawing-linux", () => { using var bmp = new System.Drawing.Bitmap(10, 10); });
Caso("generic-method", () => new Repositorio<Pedido>().Buscar<int>(5));
Caso("property-getter", () => _ = new Factura().Total);
Caso("struct-ctor", () => _ = new Dinero(-1, "ARS"));
Caso("rethrow-wrapped", () => Validador.ConContexto(() => int.Parse("x")));
Caso("throw-ex-reset", () => Validador.ThrowEx());
Caso("exception-dispatch-info", () => Validador.Rethrow());
Caso("custom-exception", () => throw new StockInsuficienteException(123, pedido: 4, faltan: 2));
Caso("validation-exception", () => System.ComponentModel.DataAnnotations.Validator.ValidateObject(new PedidoDto { Cantidad = 0 }, new System.ComponentModel.DataAnnotations.ValidationContext(new PedidoDto()), true));
Caso("semaphore-full", () => { var s = new SemaphoreSlim(1, 1); s.Release(); });
Caso("lock-recursion", () => { var rw = new ReaderWriterLockSlim(); rw.EnterReadLock(); rw.EnterWriteLock(); });
Caso("win32-process", () => System.Diagnostics.Process.Start("/usr/bin/no-existe-este-binario"));
CasoAsync("fire-and-forget", async () => { var tcs = new TaskCompletionSource<Exception>(); _ = Task.Run(async () => { try { await Task.Yield(); new ServicioClientes(new RepositorioClientes()).ArmarSaludo(1); } catch (Exception ex) { tcs.SetResult(ex); } }); throw await tcs.Task; });
Caso("thread-exception", () => { Exception? capt = null; var t = new Thread(() => { try { Importador.ParsearEdades(new[] { "x" }); } catch (Exception ex) { capt = ex; } }); t.Start(); t.Join(); throw capt!; });
Caso("timer-callback", () => { Exception? capt = null; using var mre = new ManualResetEventSlim(); using var t = new Timer(_ => { try { Validador.Validar(-2); } catch (Exception ex) { capt = ex; } mre.Set(); }, null, 0, Timeout.Infinite); mre.Wait(); throw capt!; });

// HTTP
var http = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
CasoAsync("http-timeout", () => http.GetStringAsync("http://127.0.0.1:5088/lento"));
CasoAsync("http-refused", () => new HttpClient().GetStringAsync("http://127.0.0.1:5999/api/clientes"));
CasoAsync("http-dns", () => new HttpClient().GetStringAsync("http://servicio-que-no-existe.interno.local/api"));
CasoAsync("http-status-500", () => new HttpClient().GetStringAsync("http://127.0.0.1:5088/error500"));
CasoAsync("http-status-404", async () => { var r = await new HttpClient().GetAsync("http://127.0.0.1:5088/nada"); r.EnsureSuccessStatusCode(); });
CasoAsync("http-json-bad", async () => { using var c = new HttpClient(); _ = await c.GetFromJsonAsync<Cliente>("http://127.0.0.1:5088/error500"); });
CasoAsync("http-tls", () => new HttpClient().GetStringAsync("https://127.0.0.1:5089/"));
CasoAsync("http-cancel", async () => { using var cts = new CancellationTokenSource(); cts.CancelAfter(100); await new HttpClient().GetStringAsync("http://127.0.0.1:5088/lento", cts.Token); });
CasoAsync("socket-refused", async () => { using var s = new System.Net.Sockets.TcpClient(); await s.ConnectAsync("127.0.0.1", 5999); });
Caso("redis-refused", () => StackExchange.Redis.ConnectionMultiplexer.Connect("127.0.0.1:6399,abortConnect=true,connectTimeout=500"));
CasoAsync("redis-refused-async", () => StackExchange.Redis.ConnectionMultiplexer.ConnectAsync("127.0.0.1:6399,abortConnect=true,connectTimeout=500"));

// ASP.NET Core: la excepción la registra el logger del ExceptionHandler, con los frames del pipeline.
CasoAsync("aspnet-unhandled", () => DesdeAspNet(http, "http://127.0.0.1:5088/pedidos/99", capturador));
CasoAsync("aspnet-nullref", () => DesdeAspNet(http, "http://127.0.0.1:5088/clientes/1", capturador));
CasoAsync("aspnet-badrequest-json", async () => { var r = await new HttpClient().PostAsync("http://127.0.0.1:5088/pedidos", new StringContent("{\"id\":\"x\"", System.Text.Encoding.UTF8, "application/json")); throw new Exception($"status {(int)r.StatusCode}: {await r.Content.ReadAsStringAsync()}"); });
Caso("di-unresolved", () => { var sc = new ServiceCollection(); sc.AddScoped<ServicioPedidos>(); sc.BuildServiceProvider().CreateScope().ServiceProvider.GetRequiredService<ServicioPedidos>(); });
Caso("di-scoped-from-root", () => { var sc = new ServiceCollection(); sc.AddScoped<RepositorioPedidos>(); sc.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true }).GetRequiredService<RepositorioPedidos>(); });
Caso("di-no-registered", () => app.Services.GetRequiredService<Factura>());

// SQL Server
var invariante = Environment.GetEnvironmentVariable("DOTNET_SYSTEM_GLOBALIZATION_INVARIANT") == "1";
if (sqlCs is not null && !invariante)
{
    using (var cn = new SqlConnection(sqlCs)) { cn.Open(); using var cmd = cn.CreateCommand(); cmd.CommandText = Esquemas.SqlServer; cmd.ExecuteNonQuery(); }
    Caso("sql-duplicate-key", () => Sql.Exec(sqlCs, "INSERT INTO Clientes (Id, Nombre, Email) VALUES (1, 'Ana', 'ana@ejemplo.com')"));
    Caso("sql-unique-index", () => Sql.Exec(sqlCs, "INSERT INTO Clientes (Id, Nombre, Email) VALUES (50, 'Otra', 'ana@ejemplo.com')"));
    Caso("sql-null-insert", () => Sql.Exec(sqlCs, "INSERT INTO Clientes (Id, Nombre) VALUES (51, NULL)"));
    Caso("sql-fk", () => Sql.Exec(sqlCs, "INSERT INTO Pedidos (Id, ClienteId, Total) VALUES (900, 404, 10)"));
    Caso("sql-fk-delete", () => Sql.Exec(sqlCs, "DELETE FROM Clientes WHERE Id = 1"));
    Caso("sql-truncate", () => Sql.Exec(sqlCs, "INSERT INTO Clientes (Id, Nombre, Email) VALUES (52, REPLICATE('x', 200), 'x@x.com')"));
    Caso("sql-invalid-object", () => Sql.Exec(sqlCs, "SELECT * FROM Clientess"));
    Caso("sql-invalid-column", () => Sql.Exec(sqlCs, "SELECT Nombree FROM Clientes"));
    Caso("sql-conversion", () => Sql.Exec(sqlCs, "SELECT * FROM Clientes WHERE Id = 'abc'"));
    Caso("sql-conversion-date", () => Sql.Exec(sqlCs, "SELECT CONVERT(datetime, '31/02/2026', 103)"));
    Caso("sql-arithmetic-overflow", () => Sql.Exec(sqlCs, "SELECT CAST(123456.78 AS decimal(5,2))"));
    Caso("sql-divide-zero", () => Sql.Exec(sqlCs, "SELECT 1/0"));
    Caso("sql-param-missing", () => Sql.Exec(sqlCs, "SELECT * FROM Clientes WHERE Id = @Id"));
    Caso("sql-param-missing-dapper", () => { using var cn = new SqlConnection(sqlCs); cn.Query<Cliente>("SELECT * FROM Clientes WHERE Id = @Id", new { Idd = 1 }); });
    Caso("sql-timeout", () => Sql.Exec(sqlCs, "WAITFOR DELAY '00:00:03'", timeout: 1));
    Caso("sql-check", () => Sql.Exec(sqlCs, "INSERT INTO Pedidos (Id, ClienteId, Total) VALUES (901, 1, -5)"));
    Caso("sql-raiserror", () => Sql.Exec(sqlCs, "RAISERROR('El pedido 7 ya fue facturado', 16, 1)"));
    Caso("sql-throw", () => Sql.Exec(sqlCs, "THROW 50001, 'Stock insuficiente para el producto 12', 1"));
    Caso("sql-proc-missing", () => Sql.Exec(sqlCs, "EXEC dbo.usp_NoExiste"));
    Caso("sql-login-failed", () => Sql.Exec(new SqlConnectionStringBuilder(sqlCs) { Password = "incorrecta" }.ConnectionString, "SELECT 1"));
    Caso("sql-db-missing", () => Sql.Exec(new SqlConnectionStringBuilder(sqlCs) { InitialCatalog = "VentasQA" }.ConnectionString, "SELECT 1"));
    Caso("sql-network", () => Sql.Exec(new SqlConnectionStringBuilder(sqlCs) { DataSource = "127.0.0.1,1499", ConnectTimeout = 2 }.ConnectionString, "SELECT 1"));
    Caso("sql-network-host", () => Sql.Exec(new SqlConnectionStringBuilder(sqlCs) { DataSource = "srv-sql-qa", ConnectTimeout = 2 }.ConnectionString, "SELECT 1"));
    Caso("sql-cert", () => Sql.Exec(new SqlConnectionStringBuilder(sqlCs) { TrustServerCertificate = false, Encrypt = true }.ConnectionString, "SELECT 1"));
    Caso("sql-deadlock", () => Sql.Deadlock(sqlCs));
    Caso("sql-reader-dbnull", () => Sql.Leer(sqlCs, "SELECT Telefono FROM Clientes WHERE Id = 1", r => (string)r["Telefono"]));
    Caso("sql-reader-getstring", () => Sql.Leer(sqlCs, "SELECT Telefono FROM Clientes WHERE Id = 1", r => r.GetString(0)));
    Caso("sql-reader-cast", () => Sql.Leer(sqlCs, "SELECT Id FROM Clientes WHERE Id = 1", r => (long)r["Id"]));
    Caso("sql-reader-getint-wrong", () => Sql.Leer(sqlCs, "SELECT Total FROM Pedidos WHERE Id = 1", r => r.GetInt32(0)));
    Caso("sql-reader-column", () => Sql.Leer(sqlCs, "SELECT Id FROM Clientes WHERE Id = 1", r => r["Nombre"]));
    Caso("sql-reader-closed", () => { using var cn = new SqlConnection(sqlCs); cn.Open(); using var cmd = new SqlCommand("SELECT Id FROM Clientes", cn); var r = cmd.ExecuteReader(); r.Close(); r.Read(); });
    Caso("sql-connection-closed", () => { using var cn = new SqlConnection(sqlCs); using var cmd = new SqlCommand("SELECT 1", cn); cmd.ExecuteScalar(); });
    Caso("sql-mars", () => { using var cn = new SqlConnection(new SqlConnectionStringBuilder(sqlCs) { MultipleActiveResultSets = false }.ConnectionString); cn.Open(); using var r = new SqlCommand("SELECT Id FROM Clientes", cn).ExecuteReader(); r.Read(); new SqlCommand("SELECT 1", cn).ExecuteScalar(); });
    Caso("sql-pool-exhausted", () => Sql.AgotarPool(sqlCs));
    Caso("sql-transaction-zombie", () => { using var cn = new SqlConnection(sqlCs); cn.Open(); var tx = cn.BeginTransaction(); tx.Commit(); tx.Commit(); });
    Caso("sql-command-no-tx", () => { using var cn = new SqlConnection(sqlCs); cn.Open(); using var tx = cn.BeginTransaction(); new SqlCommand("SELECT 1", cn).ExecuteScalar(); });
    Caso("sql-bulk-copy", () => { using var cn = new SqlConnection(sqlCs); cn.Open(); var dt = new DataTable(); dt.Columns.Add("Id", typeof(int)); dt.Columns.Add("Nombre", typeof(string)); dt.Rows.Add(1, "dup"); using var bc = new SqlBulkCopy(cn) { DestinationTableName = "Clientes" }; bc.WriteToServer(dt); });
    Caso("sql-string-not-int-param", () => { using var cn = new SqlConnection(sqlCs); cn.Open(); using var cmd = new SqlCommand("SELECT * FROM Clientes WHERE Id = @id", cn); cmd.Parameters.AddWithValue("@id", "abc"); cmd.ExecuteScalar(); });
    Caso("dapper-cast", () => { using var cn = new SqlConnection(sqlCs); cn.Query<ClienteMal>("SELECT Id, Nombre, Email FROM Clientes").ToList(); });
    //Caso("dapper-dbnull", () => { using var cn = new SqlConnection(sqlCs); cn.Query<ClienteStrict>("SELECT Id, Nombre, Telefono FROM Clientes").ToList(); });
    Caso("dapper-single", () => { using var cn = new SqlConnection(sqlCs); cn.QuerySingle<Cliente>("SELECT Id, Nombre FROM Clientes WHERE Id = 404"); });
    Caso("dapper-first", () => { using var cn = new SqlConnection(sqlCs); cn.QueryFirst<Cliente>("SELECT Id, Nombre FROM Clientes WHERE Id = 404"); });
    Caso("dapper-single-many", () => { using var cn = new SqlConnection(sqlCs); cn.QuerySingle<Cliente>("SELECT Id, Nombre FROM Clientes"); });
    //Caso("dapper-param-list", () => { using var cn = new SqlConnection(sqlCs); cn.Query<Cliente>("SELECT * FROM Clientes WHERE Id IN @Ids", new { Ids = Array.Empty<int>() }).ToList(); });
    CasoAsync("dapper-async-timeout", async () => { using var cn = new SqlConnection(sqlCs); await cn.ExecuteAsync("WAITFOR DELAY '00:00:03'", commandTimeout: 1); });
    // EF Core
    var opciones = new DbContextOptionsBuilder<TiendaContext>().UseSqlServer(sqlCs).Options;
    Caso("ef-duplicate", () => { using var db = new TiendaContext(opciones); db.Clientes.Add(new ClienteEf { Id = 1, Nombre = "Repetida", Email = "r@r.com" }); db.SaveChanges(); });
    CasoAsync("ef-duplicate-async", async () => { using var db = new TiendaContext(opciones); db.Clientes.Add(new ClienteEf { Id = 1, Nombre = "Repetida", Email = "r@r.com" }); await db.SaveChangesAsync(); });
    Caso("ef-fk", () => { using var db = new TiendaContext(opciones); db.Pedidos.Add(new PedidoEf { Id = 902, ClienteId = 404, Total = 1 }); db.SaveChanges(); });
    Caso("ef-null", () => { using var db = new TiendaContext(opciones); db.Clientes.Add(new ClienteEf { Id = 60, Nombre = null!, Email = "n@n.com" }); db.SaveChanges(); });
    CasoAsync("ef-concurrency", async () => { using var db = new TiendaContext(opciones); var c = await db.Clientes.FirstAsync(x => x.Id == 1); Sql.Exec(sqlCs, "UPDATE Clientes SET Nombre = 'Cambiada por otro' WHERE Id = 1"); c.Nombre = "La mía"; await db.SaveChangesAsync(); });
    Caso("ef-concurrency-deleted", () => { using var db = new TiendaContext(opciones); var c = db.Clientes.First(x => x.Id == 2); Sql.Exec(sqlCs, "DELETE FROM Clientes WHERE Id = 2"); c.Nombre = "x"; db.SaveChanges(); });
    CasoAsync("ef-not-translated", async () => { using var db = new TiendaContext(opciones); _ = await db.Clientes.Where(c => Validador.EsValido(c.Email)).ToListAsync(); });
    CasoAsync("ef-not-translated-method", async () => { using var db = new TiendaContext(opciones); _ = await db.Clientes.Where(c => c.Nombre.ToUpperInvariant().Normalize() == "ANA").ToListAsync(); });
    CasoAsync("ef-disposed", async () => { TiendaContext db; using (db = new TiendaContext(opciones)) { } _ = await db.Clientes.ToListAsync(); });
    CasoAsync("ef-second-operation", async () => { using var db = new TiendaContext(opciones); var tareas = Enumerable.Range(0, 4).Select(_ => Task.Run(() => db.Clientes.CountAsync())).ToArray(); await Task.WhenAll(tareas); });
    Caso("ef-tracking-duplicate", () => { using var db = new TiendaContext(opciones); db.Clientes.Attach(new ClienteEf { Id = 1 }); db.Clientes.Update(new ClienteEf { Id = 1, Nombre = "x" }); });
    CasoAsync("ef-first-empty", async () => { using var db = new TiendaContext(opciones); _ = await db.Clientes.FirstAsync(c => c.Id == 404); });
    CasoAsync("ef-single-many", async () => { using var db = new TiendaContext(opciones); _ = await db.Clientes.SingleAsync(); });
    CasoAsync("ef-lazy-no-config", async () => { using var db = new TiendaContext(opciones); var p = await db.Pedidos.FirstAsync(); _ = p.Cliente!.Nombre; });
    Caso("ef-no-provider", () => { using var db = new TiendaContext(new DbContextOptionsBuilder<TiendaContext>().Options); _ = db.Clientes.ToList(); });
    Caso("ef-invalid-column-model", () => { using var db = new TiendaContext(opciones); _ = db.Set<ProductoEf>().ToList(); });
    Caso("ef-timeout", () => { using var db = new TiendaContext(opciones); db.Database.SetCommandTimeout(1); db.Database.ExecuteSqlRaw("WAITFOR DELAY '00:00:03'"); });
    CasoAsync("ef-deadlock", () => Task.Run(() => Sql.DeadlockEf(opciones, sqlCs)));
    Caso("ef-pending-migrations", () => { using var db = new TiendaContext(opciones); _ = db.Set<ClienteEf>().FromSqlRaw("SELECT Id, Nombre FROM Clientes").ToList(); });
    Caso("ef-savechanges-nested-tx", () => { using var db = new TiendaContext(opciones); using var tx = db.Database.BeginTransaction(); db.Database.BeginTransaction(); });
}
if (pgCs is not null && !invariante)
{
    using (var cn = new NpgsqlConnection(pgCs)) { cn.Open(); using var cmd = new NpgsqlCommand(Esquemas.Postgres, cn); cmd.ExecuteNonQuery(); }
    Caso("pg-duplicate-key", () => Pg.Exec(pgCs, "INSERT INTO clientes (id, nombre, email) VALUES (1, 'Ana', 'ana@ejemplo.com')"));
    Caso("pg-fk", () => Pg.Exec(pgCs, "INSERT INTO pedidos (id, cliente_id, total) VALUES (900, 404, 10)"));
    Caso("pg-null", () => Pg.Exec(pgCs, "INSERT INTO clientes (id, nombre) VALUES (51, NULL)"));
    Caso("pg-relation-missing", () => Pg.Exec(pgCs, "SELECT * FROM Clientes"));
    Caso("pg-column-missing", () => Pg.Exec(pgCs, "SELECT nombree FROM clientes"));
    Caso("pg-invalid-int", () => Pg.Exec(pgCs, "SELECT * FROM clientes WHERE id = 'abc'"));
    Caso("pg-truncate", () => Pg.Exec(pgCs, "INSERT INTO clientes (id, nombre, email) VALUES (52, repeat('x', 200), 'x@x.com')"));
    Caso("pg-check", () => Pg.Exec(pgCs, "INSERT INTO pedidos (id, cliente_id, total) VALUES (901, 1, -5)"));
    Caso("pg-statement-timeout", () => Pg.Exec(pgCs, "SET statement_timeout = 500; SELECT pg_sleep(3)"));
    Caso("pg-command-timeout", () => Pg.Exec(pgCs, "SELECT pg_sleep(3)", timeout: 1));
    //Caso("pg-password", () => Pg.Exec(new NpgsqlConnectionStringBuilder(pgCs) { Password = "incorrecta" }.ConnectionString, "SELECT 1"));
    Caso("pg-db-missing", () => Pg.Exec(new NpgsqlConnectionStringBuilder(pgCs) { Database = "ventas_qa" }.ConnectionString, "SELECT 1"));
    Caso("pg-refused", () => Pg.Exec(new NpgsqlConnectionStringBuilder(pgCs) { Port = 5499, Timeout = 2 }.ConnectionString, "SELECT 1"));
    //Caso("pg-param-missing", () => Pg.Exec(pgCs, "SELECT * FROM clientes WHERE id = @id"));
    Caso("pg-param-type", () => { using var cn = new NpgsqlConnection(pgCs); cn.Open(); using var cmd = new NpgsqlCommand("SELECT * FROM clientes WHERE id = @id", cn); cmd.Parameters.AddWithValue("id", "7"); cmd.ExecuteScalar(); });
    Caso("pg-datetime-kind", () => { using var cn = new NpgsqlConnection(pgCs); cn.Open(); using var cmd = new NpgsqlCommand("INSERT INTO pedidos (id, cliente_id, total, creado) VALUES (903, 1, 1, @f)", cn); cmd.Parameters.AddWithValue("f", DateTime.SpecifyKind(DateTime.Now, DateTimeKind.Unspecified)); cmd.ExecuteNonQuery(); });
    Caso("pg-deadlock", () => Pg.Deadlock(pgCs));
    Caso("pg-raise", () => Pg.Exec(pgCs, "DO $$ BEGIN RAISE EXCEPTION 'Stock insuficiente para el producto %', 12 USING ERRCODE = 'P0001'; END $$"));
    Caso("pg-reader-dbnull", () => { using var cn = new NpgsqlConnection(pgCs); cn.Open(); using var r = new NpgsqlCommand("SELECT telefono FROM clientes WHERE id = 1", cn).ExecuteReader(); r.Read(); _ = r.GetString(0); });
    Caso("pg-too-many-connections", () => Pg.AgotarConexiones(pgCs));
    Caso("pg-dapper-cast", () => { using var cn = new NpgsqlConnection(pgCs); cn.Query<ClienteMal>("SELECT id, nombre, email FROM clientes").ToList(); });
    Caso("pg-syntax", () => Pg.Exec(pgCs, "SELEC 1"));
}

// Un caso en modo invariante se corre en otro proceso (variable de entorno al arrancar).
if (invariante)
{
    casos.Clear();
    Caso("culture-invariant-sqlclient", () => { using var cn = new SqlConnection(sqlCs ?? "Server=localhost"); cn.Open(); });
    Caso("culture-invariant-mode", () => _ = new CultureInfo("es-AR"));
    Caso("culture-invariant-mode-compare", () => _ = string.Compare("a", "b", new CultureInfo("es-AR"), CompareOptions.IgnoreCase));
}

int ok = 0, sinExcepcion = 0;
foreach (var (nombre, correr) in casos)
{
    capturador.Ultima = null;
    string? texto = null;
    try { await correr(); }
    catch (Exception ex) { texto = ex.ToString(); }
    if (texto is null && capturador.Ultima is not null) texto = capturador.Ultima;
    if (texto is null) { Console.WriteLine($"SIN EXCEPCIÓN: {nombre}"); sinExcepcion++; continue; }
    await File.WriteAllTextAsync(Path.Combine(salida, nombre + ".txt"), texto);
    ok++;
}
Console.WriteLine($"{ok} trazas guardadas en {salida}; {sinExcepcion} casos sin excepción.");
await app.StopAsync();

static async Task DesdeAspNet(HttpClient http, string url, CapturadorDeExcepciones cap)
{
    cap.Ultima = null;
    using var r = await http.GetAsync(url);
    await Task.Delay(200);
    if (cap.Ultima is null) throw new Exception("ASP.NET no registró ninguna excepción");
}

namespace Tienda.Api
{
    public class Cliente { public int Id { get; set; } public string Nombre { get; set; } = ""; public string? Email { get; set; } }
    public class ClienteMal { public int Id { get; set; } public int Nombre { get; set; } public string? Email { get; set; } }
    public class ClienteStrict { public int Id { get; set; } public string Nombre { get; set; } = ""; public int Telefono { get; set; } }
    public class Pedido { public int Id { get; set; } public int ClienteId { get; set; } public decimal Total { get; set; } }
    public class PedidoDto { [System.ComponentModel.DataAnnotations.Range(1, 1000, ErrorMessage = "La cantidad tiene que estar entre 1 y 1000")] public int Cantidad { get; set; } }
    public class Nodo { public string Nombre { get; set; } = "raíz"; public Nodo? Padre { get; set; } }
    public class Factura { public decimal Total => Items.Sum(i => i.Precio); public List<Item> Items { get; set; } = null!; }
    public class Item { public decimal Precio { get; set; } }
    public readonly struct Dinero { public decimal Monto { get; } public string Moneda { get; } public Dinero(decimal monto, string moneda) { if (monto < 0) throw new ArgumentOutOfRangeException(nameof(monto), monto, "El monto no puede ser negativo"); Monto = monto; Moneda = moneda; } }
    public class StockInsuficienteException : Exception
    {
        public int ProductoId { get; }
        public StockInsuficienteException(int productoId, int pedido, int faltan) : base($"No hay stock del producto {productoId}: se pidieron {pedido} y faltan {faltan}") { ProductoId = productoId; }
    }
    public static class Configuracion
    {
        public static readonly string Valor = Cargar();
        static string Cargar() => Environment.GetEnvironmentVariable("TIENDA__ApiKey") ?? throw new InvalidOperationException("Falta la variable de entorno TIENDA__ApiKey");
    }
    public class Repositorio<T> { public TKey Buscar<TKey>(TKey clave) where TKey : notnull => throw new KeyNotFoundException($"No existe {typeof(T).Name} con clave {clave}"); }
    public static class Validador
    {
        public static void Validar(int monto) { if (monto <= 0) throw new ArgumentException("El monto tiene que ser positivo", nameof(monto)); }
        public static void Pendiente() => throw new NotImplementedException();
        public static bool EsValido(string? email) => email is not null && email.Contains('@');
        public static void ConContexto(Action a) { try { a(); } catch (Exception ex) { throw new InvalidOperationException("No se pudo importar la fila 12 del archivo clientes.csv", ex); } }
        public static void ThrowEx() { try { Validar(-1); } catch (Exception ex) { throw ex; } }
        public static void Rethrow() { Exception? capt = null; try { Validar(-1); } catch (Exception ex) { capt = ex; } System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(capt!).Throw(); }
    }
    public static class Importador
    {
        public static List<int> ParsearEdades(IEnumerable<string> filas) => filas.Select(f => int.Parse(f)).ToList();
        public static void ValidarTodo(IEnumerable<string> filas)
        {
            foreach (var f in filas) Validar(f);
            static void Validar(string f) { if (f.Length == 0) throw new ArgumentException("Fila vacía", nameof(f)); }
        }
        public static IEnumerable<int> Leer(IEnumerable<string> filas) { foreach (var f in filas) yield return int.Parse(f); }
    }
}
namespace Tienda.Api.Servicios
{
    using Tienda.Api.Datos;
    public class ServicioClientes
    {
        private readonly RepositorioClientes _repo;
        public ServicioClientes(RepositorioClientes repo) => _repo = repo;
        public string ArmarSaludo(int id) { var c = _repo.Buscar(id); return $"Hola, {c.Nombre.ToUpper()}"; }
    }
    public class ServicioPedidos
    {
        private readonly IRepositorioPedidos _repo;
        public ServicioPedidos(IRepositorioPedidos repo) => _repo = repo;
        public async Task<Pedido> ObtenerAsync(int id) { await Task.Yield(); var p = await _repo.BuscarAsync(id); await Task.Delay(1); return p; }
    }
}
namespace Tienda.Api.Datos
{
    public class RepositorioClientes { public Cliente Buscar(int id) => id == 7 ? null! : new Cliente { Id = id, Nombre = null! }; }
    public interface IRepositorioPedidos { Task<Pedido> BuscarAsync(int id); }
    public class RepositorioPedidos : IRepositorioPedidos
    {
        public async Task<Pedido> BuscarAsync(int id) { await Task.Delay(1); return await LeerFilaAsync(id); }
        private async Task<Pedido> LeerFilaAsync(int id) { await Task.Yield(); throw new InvalidOperationException($"No existe el pedido {id}"); }
    }
    public class ClienteEf { public int Id { get; set; } public string Nombre { get; set; } = ""; public string? Email { get; set; } public string? Telefono { get; set; } public byte[]? Version { get; set; } public List<PedidoEf> Pedidos { get; set; } = new(); }
    public class PedidoEf { public int Id { get; set; } public int ClienteId { get; set; } public ClienteEf? Cliente { get; set; } public decimal Total { get; set; } }
    public class ProductoEf { public int Id { get; set; } public string Nombre { get; set; } = ""; public decimal PrecioUnitario { get; set; } }
    public class TiendaContext : DbContext
    {
        public TiendaContext(DbContextOptions<TiendaContext> o) : base(o) { }
        public DbSet<ClienteEf> Clientes => Set<ClienteEf>();
        public DbSet<PedidoEf> Pedidos => Set<PedidoEf>();
        protected override void OnModelCreating(ModelBuilder mb)
        {
            mb.Entity<ClienteEf>().ToTable("Clientes").Property(c => c.Version).IsRowVersion();
            mb.Entity<PedidoEf>().ToTable("Pedidos");
            mb.Entity<ProductoEf>().ToTable("Productos");
        }
    }
    public static class Esquemas
    {
        public const string SqlServer = """
            IF OBJECT_ID('Pedidos') IS NOT NULL DROP TABLE Pedidos;
            IF OBJECT_ID('Clientes') IS NOT NULL DROP TABLE Clientes;
            IF OBJECT_ID('Productos') IS NOT NULL DROP TABLE Productos;
            CREATE TABLE Clientes (Id int NOT NULL CONSTRAINT PK_Clientes PRIMARY KEY, Nombre nvarchar(100) NOT NULL, Email varchar(200) NULL, Telefono varchar(30) NULL, Version rowversion);
            CREATE UNIQUE INDEX UX_Clientes_Email ON Clientes (Email) WHERE Email IS NOT NULL;
            CREATE TABLE Pedidos (Id int NOT NULL CONSTRAINT PK_Pedidos PRIMARY KEY, ClienteId int NOT NULL CONSTRAINT FK_Pedidos_Clientes FOREIGN KEY REFERENCES Clientes(Id), Total decimal(18,2) NOT NULL CONSTRAINT CK_Pedidos_Total CHECK (Total >= 0));
            CREATE TABLE Productos (Id int NOT NULL PRIMARY KEY, Nombre nvarchar(100) NOT NULL, Precio decimal(18,2) NOT NULL);
            INSERT INTO Clientes (Id, Nombre, Email) VALUES (1, 'Ana', 'ana@ejemplo.com'), (2, 'Bruno', 'bruno@ejemplo.com'), (3, 'Carla', NULL);
            INSERT INTO Pedidos (Id, ClienteId, Total) VALUES (1, 1, 1500.50), (2, 2, 300);
            """;
        public const string Postgres = """
            DROP TABLE IF EXISTS pedidos; DROP TABLE IF EXISTS clientes;
            CREATE TABLE clientes (id int PRIMARY KEY, nombre varchar(100) NOT NULL, email varchar(200) UNIQUE, telefono varchar(30));
            CREATE TABLE pedidos (id int PRIMARY KEY, cliente_id int NOT NULL REFERENCES clientes(id), total numeric(18,2) NOT NULL CHECK (total >= 0), creado timestamptz NOT NULL DEFAULT now());
            INSERT INTO clientes (id, nombre, email) VALUES (1, 'Ana', 'ana@ejemplo.com'), (2, 'Bruno', 'bruno@ejemplo.com'), (3, 'Carla', NULL);
            INSERT INTO pedidos (id, cliente_id, total) VALUES (1, 1, 1500.50), (2, 2, 300);
            """;
    }
    public static class Sql
    {
        public static void Exec(string cs, string sql, int timeout = 30)
        {
            using var cn = new SqlConnection(cs); cn.Open();
            using var cmd = new SqlCommand(sql, cn) { CommandTimeout = timeout };
            cmd.ExecuteNonQuery();
        }
        public static void Leer(string cs, string sql, Func<SqlDataReader, object?> f)
        {
            using var cn = new SqlConnection(cs); cn.Open();
            using var cmd = new SqlCommand(sql, cn);
            using var r = cmd.ExecuteReader(); r.Read(); f(r);
        }
        public static void Deadlock(string cs)
        {
            var b = new Barrier(2);
            Exception? capt = null;
            void Lado(int primero, int segundo)
            {
                try
                {
                    using var cn = new SqlConnection(cs); cn.Open();
                    using var tx = cn.BeginTransaction();
                    new SqlCommand($"UPDATE Clientes SET Nombre = Nombre WHERE Id = {primero}", cn, tx).ExecuteNonQuery();
                    b.SignalAndWait();
                    new SqlCommand($"UPDATE Clientes SET Nombre = Nombre WHERE Id = {segundo}", cn, tx).ExecuteNonQuery();
                    tx.Commit();
                }
                catch (Exception ex) { capt ??= ex; }
            }
            var t1 = new Thread(() => Lado(1, 2)); var t2 = new Thread(() => Lado(2, 1));
            t1.Start(); t2.Start(); t1.Join(); t2.Join();
            if (capt is not null) throw capt;
        }
        public static void DeadlockEf(DbContextOptions<TiendaContext> opciones, string cs)
        {
            var b = new Barrier(2);
            Exception? capt = null;
            void Lado(int primero, int segundo)
            {
                try
                {
                    using var db = new TiendaContext(opciones);
                    using var tx = db.Database.BeginTransaction();
                    var a = db.Clientes.First(c => c.Id == primero); a.Telefono = "1"; db.SaveChanges();
                    b.SignalAndWait();
                    var c2 = db.Clientes.First(c => c.Id == segundo); c2.Telefono = "2"; db.SaveChanges();
                    tx.Commit();
                }
                catch (Exception ex) { capt ??= ex; }
            }
            var t1 = new Thread(() => Lado(1, 2)); var t2 = new Thread(() => Lado(2, 1));
            t1.Start(); t2.Start(); t1.Join(); t2.Join();
            if (capt is not null) throw capt;
        }
        public static void AgotarPool(string cs)
        {
            var chico = new SqlConnectionStringBuilder(cs) { MaxPoolSize = 2, ConnectTimeout = 2 }.ConnectionString;
            var abiertas = new List<SqlConnection>();
            try { for (int i = 0; i < 3; i++) { var cn = new SqlConnection(chico); cn.Open(); abiertas.Add(cn); } }
            finally { foreach (var cn in abiertas) cn.Dispose(); }
        }
    }
    public static class Pg
    {
        public static void Exec(string cs, string sql, int timeout = 30)
        {
            using var cn = new NpgsqlConnection(cs); cn.Open();
            using var cmd = new NpgsqlCommand(sql, cn) { CommandTimeout = timeout };
            cmd.ExecuteNonQuery();
        }
        public static void Deadlock(string cs)
        {
            var b = new Barrier(2);
            Exception? capt = null;
            void Lado(int primero, int segundo)
            {
                try
                {
                    using var cn = new NpgsqlConnection(cs); cn.Open();
                    using var tx = cn.BeginTransaction();
                    new NpgsqlCommand($"UPDATE clientes SET nombre = nombre WHERE id = {primero}", cn, tx).ExecuteNonQuery();
                    b.SignalAndWait();
                    new NpgsqlCommand($"UPDATE clientes SET nombre = nombre WHERE id = {segundo}", cn, tx).ExecuteNonQuery();
                    tx.Commit();
                }
                catch (Exception ex) { capt ??= ex; }
            }
            var t1 = new Thread(() => Lado(1, 2)); var t2 = new Thread(() => Lado(2, 1));
            t1.Start(); t2.Start(); t1.Join(); t2.Join();
            if (capt is not null) throw capt;
        }
        public static void AgotarConexiones(string cs)
        {
            var chico = new NpgsqlConnectionStringBuilder(cs) { MaxPoolSize = 2, Timeout = 2 }.ConnectionString;
            var abiertas = new List<NpgsqlConnection>();
            try { for (int i = 0; i < 3; i++) { var cn = new NpgsqlConnection(chico); cn.Open(); abiertas.Add(cn); } }
            finally { foreach (var cn in abiertas) cn.Dispose(); }
        }
    }
}
public sealed class CapturadorDeExcepciones : ILoggerProvider, ILogger
{
    public string? Ultima;
    public ILogger CreateLogger(string categoryName) => this;
    public void Dispose() { }
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Error;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    { if (exception is not null) Ultima = exception.ToString(); }
}
