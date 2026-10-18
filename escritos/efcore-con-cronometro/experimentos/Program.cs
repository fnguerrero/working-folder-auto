using System.Text.Json;
using Dapper;
using Experimentos;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

var cs = Environment.GetEnvironmentVariable("SQL_CS") ?? throw new Exception("Falta SQL_CS (cadena de conexión a la base Tienda)");
var salida = args.FirstOrDefault(a => a.EndsWith(".json")) ?? "resultados.json";
if (args.Contains("--cargar")) Carga.Crear(cs);
var solo = args.Where(a => !a.StartsWith("--") && !a.EndsWith(".json")).ToHashSet();
bool Va(string cap) => solo.Count == 0 || solo.Contains(cap);

var m = new Medidor(cs);
var opciones = m.Opciones();
var azar = new Random(7);
int[] IdsAlAzar(int n) { var set = new HashSet<int>(); while (set.Count < n) set.Add(azar.Next(1, Carga.Pedidos + 1)); return set.OrderBy(x => x).ToArray(); }
var esAR = new System.Globalization.CultureInfo("es-AR");
void Sql(string sql) { using var c = new SqlCommand(sql, m.Conexion) { CommandTimeout = 600 }; c.ExecuteNonQuery(); }
T Escalar<T>(string sql) { using var c = new SqlCommand(sql, m.Conexion); return (T)c.ExecuteScalar()!; }

// ---------- 1. N+1 ----------
if (Va("n1"))
{
    m.Medir("n1", "Un viaje por pedido: Entry(p).Collection(p => p.Items).Load()", () =>
    {
        using var ctx = m.Contexto();
        var pedidos = ctx.Pedidos.Where(p => p.ClienteId == 2).ToList();
        int n = 0;
        foreach (var p in pedidos) { ctx.Entry(p).Collection(x => x.Items).Load(); n += p.Items.Count; }
        return n;
    });
    m.LazyLoading = true;
    m.Medir("n1", "Lazy loading: foreach (var p in pedidos) n += p.Items.Count", () =>
    {
        using var ctx = new TiendaContext(m.Opciones());
        var pedidos = ctx.Pedidos.Where(p => p.ClienteId == 2).ToList();
        int n = 0;
        foreach (var p in pedidos) n += p.Items.Count;
        return n;
    });
    m.LazyLoading = false;
    m.Medir("n1", "Include(p => p.Items)", () =>
    {
        using var ctx = m.Contexto();
        return ctx.Pedidos.Where(p => p.ClienteId == 2).Include(p => p.Items).ToList().Sum(p => p.Items.Count);
    });
    m.Medir("n1", "Proyección: Select(p => new { p.PedidoId, Cantidad = p.Items.Count })", () =>
    {
        using var ctx = m.Contexto();
        return ctx.Pedidos.Where(p => p.ClienteId == 2).Select(p => new { p.PedidoId, Cantidad = p.Items.Count }).ToList().Sum(p => p.Cantidad);
    });
    m.Medir("n1", "Proyección con los ítems adentro: Select(p => new { p.PedidoId, Items = p.Items.Select(…).ToList() })", () =>
    {
        using var ctx = m.Contexto();
        return ctx.Pedidos.Where(p => p.ClienteId == 2).Select(p => new { p.PedidoId, Items = p.Items.Select(i => new { i.ProductoId, i.Cantidad }).ToList() }).ToList().Sum(p => p.Items.Count);
    });
}

// ---------- 2. Explosión cartesiana ----------
if (Va("cartesiano"))
{
    IQueryable<Pedido> Base(TiendaContext ctx) => ctx.Pedidos.Where(p => p.ClienteId == 1).OrderBy(p => p.PedidoId).Take(1000);
    m.Medir("cartesiano", "Include(p => p.Items)", () => { using var ctx = m.Contexto(false); return Base(ctx).Include(p => p.Items).ToList().Count; });
    m.Medir("cartesiano", "Include(p => p.Items).Include(p => p.Eventos)", () => { using var ctx = m.Contexto(false); return Base(ctx).Include(p => p.Items).Include(p => p.Eventos).ToList().Count; });
    m.Medir("cartesiano", "Include(p => p.Items).Include(p => p.Eventos).AsSplitQuery()", () => { using var ctx = m.Contexto(false); return Base(ctx).Include(p => p.Items).Include(p => p.Eventos).AsSplitQuery().ToList().Count; });
    m.Medir("cartesiano", "Proyección: Select(p => new { p.PedidoId, p.Total, Items = p.Items.Select(…).ToList(), Eventos = p.Eventos.Select(…).ToList() })", () =>
    {
        using var ctx = m.Contexto(false);
        return Base(ctx).Select(p => new { p.PedidoId, p.Total, Items = p.Items.Select(i => new { i.ProductoId, i.Cantidad }).ToList(), Eventos = p.Eventos.Select(e => new { e.Fecha, e.Tipo }).ToList() }).ToList().Count;
    });
}

// ---------- 3. Tracking ----------
if (Va("tracking"))
{
    IQueryable<Pedido> Veinte(TiendaContext ctx) => ctx.Pedidos.Where(p => p.PedidoId <= 20000);
    m.Medir("tracking", "ToList() rastreando (lo que hace por defecto)", () => { using var ctx = m.Contexto(); return Veinte(ctx).ToList().Count; });
    m.Medir("tracking", "AsNoTracking().ToList()", () => { using var ctx = m.Contexto(); return Veinte(ctx).AsNoTracking().ToList().Count; });
    m.Medir("tracking", "Include(p => p.Cliente), rastreando", () => { using var ctx = m.Contexto(); return Veinte(ctx).Include(p => p.Cliente).ToList().Count; });
    Cliente.PedidosComoHashSet = true;
    m.Medir("tracking", "Include(p => p.Cliente), rastreando, con Cliente.Pedidos inicializada como HashSet<Pedido>", () => { using var ctx = m.Contexto(); return Veinte(ctx).Include(p => p.Cliente).ToList().Count; });
    Cliente.PedidosComoHashSet = false;
    m.Medir("tracking", "Include(p => p.Cliente).AsNoTracking()", () => { using var ctx = m.Contexto(); var l = Veinte(ctx).Include(p => p.Cliente).AsNoTracking().ToList(); return l.Select(p => p.Cliente).Distinct(ReferenceEqualityComparer.Instance).Count(); });
    m.Medir("tracking", "Include(p => p.Cliente).AsNoTrackingWithIdentityResolution()", () => { using var ctx = m.Contexto(); var l = Veinte(ctx).Include(p => p.Cliente).AsNoTrackingWithIdentityResolution().ToList(); return l.Select(p => p.Cliente).Distinct(ReferenceEqualityComparer.Instance).Count(); });
    Cliente.PedidosComoHashSet = true;
    m.Medir("tracking", "Include(p => p.Cliente).AsNoTrackingWithIdentityResolution(), con Cliente.Pedidos como HashSet<Pedido>", () => { using var ctx = m.Contexto(); var l = Veinte(ctx).Include(p => p.Cliente).AsNoTrackingWithIdentityResolution().ToList(); return l.Select(p => p.Cliente).Distinct(ReferenceEqualityComparer.Instance).Count(); });
    Cliente.PedidosComoHashSet = false;
    m.Medir("tracking", "ToList() rastreando y después SaveChanges() sin haber cambiado nada", () => { using var ctx = m.Contexto(); var l = Veinte(ctx).ToList(); return ctx.SaveChanges(); });
}

// ---------- 4. Proyección ----------
if (Va("proyeccion"))
{
    IQueryable<Pedido> Veinte(TiendaContext ctx) => ctx.Pedidos.AsNoTracking().Where(p => p.PedidoId <= 20000);
    m.Medir("proyeccion", "La entidad completa (con Notas)", () => { using var ctx = m.Contexto(); return Veinte(ctx).ToList().Count; });
    m.Medir("proyeccion", "Select(p => new { p.PedidoId, p.Total })", () => { using var ctx = m.Contexto(); return Veinte(ctx).Select(p => new { p.PedidoId, p.Total }).ToList().Count; });
    m.Medir("proyeccion", "Select(p => new PedidoResumen(p.PedidoId, p.Fecha, p.Estado, p.Total))", () => { using var ctx = m.Contexto(); return Veinte(ctx).Select(p => new PedidoResumen(p.PedidoId, p.Fecha, p.Estado, p.Total)).ToList().Count; });
    m.Medir("proyeccion", "Sum(p => p.Total) en el servidor", () => { using var ctx = m.Contexto(); return Veinte(ctx).Sum(p => p.Total); });
    m.Medir("proyeccion", "ToList().Sum(p => p.Total) (la cuenta en el cliente)", () => { using var ctx = m.Contexto(); return Veinte(ctx).ToList().Sum(p => p.Total); });
}

// ---------- 5. Paginación ----------
if (Va("paginacion"))
{
    const int tam = 50;
    m.Medir("paginacion", "OrderBy(PedidoId).Skip(0).Take(50): página 1", () => { using var ctx = m.Contexto(false); return ctx.Pedidos.OrderBy(p => p.PedidoId).Skip(0).Take(tam).ToList().Count; });
    m.Medir("paginacion", "OrderBy(PedidoId).Skip(99.950).Take(50): página 2.000", () => { using var ctx = m.Contexto(false); return ctx.Pedidos.OrderBy(p => p.PedidoId).Skip(1999 * tam).Take(tam).ToList().Count; });
    m.Medir("paginacion", "OrderBy(PedidoId).Skip(399.950).Take(50): página 8.000 (la última)", () => { using var ctx = m.Contexto(false); return ctx.Pedidos.OrderBy(p => p.PedidoId).Skip(7999 * tam).Take(tam).ToList().Count; });
    m.Medir("paginacion", "Where(p => p.PedidoId > ultimo).OrderBy(PedidoId).Take(50): keyset, página 1", () => { using var ctx = m.Contexto(false); int ultimo = 0; return ctx.Pedidos.Where(p => p.PedidoId > ultimo).OrderBy(p => p.PedidoId).Take(tam).ToList().Count; });
    m.Medir("paginacion", "Where(p => p.PedidoId > ultimo).OrderBy(PedidoId).Take(50): keyset, página 8.000", () => { using var ctx = m.Contexto(false); int ultimo = 7999 * tam; return ctx.Pedidos.Where(p => p.PedidoId > ultimo).OrderBy(p => p.PedidoId).Take(tam).ToList().Count; });
    m.Medir("paginacion", "OrderBy(Fecha).ThenBy(PedidoId).Skip(399.950).Take(50): página 8.000 por fecha", () => { using var ctx = m.Contexto(false); return ctx.Pedidos.OrderBy(p => p.Fecha).ThenBy(p => p.PedidoId).Skip(7999 * tam).Take(tam).ToList().Count; });
    m.Medir("paginacion", "Where(p => p.Fecha > f || (p.Fecha == f && p.PedidoId > id)).OrderBy(Fecha).ThenBy(PedidoId).Take(50): keyset por fecha, página 8.000", () =>
    {
        using var ctx = m.Contexto(false);
        var f = new DateTime(2022, 1, 1).AddMinutes(7999 * tam * 4.5); int id = 7999 * tam;
        return ctx.Pedidos.Where(p => p.Fecha > f || (p.Fecha == f && p.PedidoId > id)).OrderBy(p => p.Fecha).ThenBy(p => p.PedidoId).Take(tam).ToList().Count;
    });
}

// ---------- 6. Contains ----------
if (Va("contains"))
{
    var listas = new Dictionary<int, int[]> { [10] = IdsAlAzar(10), [1000] = IdsAlAzar(1000), [10000] = IdsAlAzar(10000) };
    foreach (var (n, ids) in listas)
        m.Medir("contains", $"Where(p => ids.Contains(p.PedidoId)) con {n.ToString("N0", esAR)} ids, EF Core 8 (OPENJSON)", () => { using var ctx = m.Contexto(false); return ctx.Pedidos.Where(p => ids.Contains(p.PedidoId)).Select(p => p.Total).ToList().Count; });
    m.CompatibilityLevel = 120;
    foreach (var (n, ids) in listas)
        m.Medir("contains", $"Where(p => ids.Contains(p.PedidoId)) con {n.ToString("N0", esAR)} ids, UseCompatibilityLevel(120) (IN con literales)", () => { using var ctx = m.Contexto(false); return ctx.Pedidos.Where(p => ids.Contains(p.PedidoId)).Select(p => p.Total).ToList().Count; });
    m.CompatibilityLevel = null;
    var ids1k = listas[1000];
    m.Medir("contains", "Lo mismo con 1.000 ids pero sobre Clientes.Email (texto) en vez de la clave: Where(c => emails.Contains(c.Email))", () =>
    {
        var emails = ids1k.Select(i => $"cliente{i}@ejemplo.com.ar").ToArray();
        using var ctx = m.Contexto(false); return ctx.Clientes.Where(c => emails.Contains(c.Email)).Select(c => c.ClienteId).ToList().Count;
    });
}

// ---------- 7. Lo que trae de más ----------
if (Va("demas"))
{
    IQueryable<Pedido> C1(TiendaContext ctx) => ctx.Pedidos.AsNoTracking().Where(p => p.ClienteId == 1);
    m.Medir("demas", "Any()", () => { using var ctx = m.Contexto(); return C1(ctx).Any(); });
    m.Medir("demas", "Count() > 0", () => { using var ctx = m.Contexto(); return C1(ctx).Count() > 0; });
    m.Medir("demas", "FirstOrDefault() != null", () => { using var ctx = m.Contexto(); return C1(ctx).FirstOrDefault() != null; });
    m.Medir("demas", "ToList().Any()", () => { using var ctx = m.Contexto(); return C1(ctx).ToList().Any(); });
    m.Medir("demas", "Count(p => p.Total > 50000)", () => { using var ctx = m.Contexto(); return C1(ctx).Count(p => p.Total > 50000); });
    m.Medir("demas", "ToList().Count(p => p.Total > 50000)", () => { using var ctx = m.Contexto(); return C1(ctx).ToList().Count(p => p.Total > 50000); });
    m.Medir("demas", "Where(p => p.Total > 50000).OrderByDescending(p => p.Fecha).Take(10).ToList()", () => { using var ctx = m.Contexto(); return C1(ctx).Where(p => p.Total > 50000).OrderByDescending(p => p.Fecha).Take(10).ToList().Count; });
    m.Medir("demas", "ToList().Where(p => p.Total > 50000).OrderByDescending(p => p.Fecha).Take(10).ToList()", () => { using var ctx = m.Contexto(); return C1(ctx).ToList().Where(p => p.Total > 50000).OrderByDescending(p => p.Fecha).Take(10).ToList().Count; });
    Sql("CREATE INDEX IX_Pedidos_Cliente_Fecha ON dbo.Pedidos (ClienteId, Fecha DESC) INCLUDE (Total)");
    m.Medir("demas", "Where(p => p.Total > 50000).OrderByDescending(p => p.Fecha).Take(10).ToList(), con un índice sobre (ClienteId, Fecha) INCLUDE (Total)", () => { using var ctx = m.Contexto(); return C1(ctx).Where(p => p.Total > 50000).OrderByDescending(p => p.Fecha).Take(10).ToList().Count; });
    Sql("DROP INDEX IX_Pedidos_Cliente_Fecha ON dbo.Pedidos");
}

// ---------- 8. Insertar ----------
if (Va("insertar"))
{
    List<Pedido> Nuevos(int n) => Enumerable.Range(0, n).Select(i => new Pedido { ClienteId = 4, Fecha = DateTime.UtcNow, Estado = "Nuevo", Total = 100 + i, Notas = "pedido de prueba " + i }).ToList();
    void Limpiar() { Sql("DELETE FROM dbo.Pedidos WHERE PedidoId > 400000; DBCC CHECKIDENT('dbo.Pedidos', RESEED, 400000)"); }
    m.Medir("insertar", "2.000 pedidos: Add + SaveChanges adentro del foreach", () =>
    {
        using var ctx = m.Contexto();
        foreach (var p in Nuevos(2000)) { ctx.Pedidos.Add(p); ctx.SaveChanges(); }
        return 2000;
    }, antesDeCada: Limpiar, repeticiones: 3);
    m.Medir("insertar", "2.000 pedidos: AddRange + un SaveChanges", () => { using var ctx = m.Contexto(); ctx.Pedidos.AddRange(Nuevos(2000)); return ctx.SaveChanges(); }, antesDeCada: Limpiar);
    m.Medir("insertar", "2.000 pedidos: SqlBulkCopy", () => Bulk(Nuevos(2000)), antesDeCada: Limpiar);
    m.Medir("insertar", "20.000 pedidos: AddRange + un SaveChanges", () => { using var ctx = m.Contexto(); ctx.Pedidos.AddRange(Nuevos(20000)); return ctx.SaveChanges(); }, antesDeCada: Limpiar, repeticiones: 3);
    m.Medir("insertar", "20.000 pedidos: SqlBulkCopy", () => Bulk(Nuevos(20000)), antesDeCada: Limpiar);
    m.Medir("insertar", "20.000 pedidos: AddRange + SaveChanges con AutoDetectChangesEnabled = false", () =>
    {
        using var ctx = m.Contexto();
        ctx.ChangeTracker.AutoDetectChangesEnabled = false;
        ctx.Pedidos.AddRange(Nuevos(20000)); return ctx.SaveChanges();
    }, antesDeCada: Limpiar, repeticiones: 3);
    Limpiar();
    object Bulk(List<Pedido> pedidos)
    {
        var t = new System.Data.DataTable();
        t.Columns.Add("ClienteId", typeof(int)); t.Columns.Add("Fecha", typeof(DateTime)); t.Columns.Add("Estado", typeof(string)); t.Columns.Add("Total", typeof(decimal)); t.Columns.Add("Notas", typeof(string));
        foreach (var p in pedidos) t.Rows.Add(p.ClienteId, p.Fecha, p.Estado, p.Total, p.Notas);
        using var bulk = new SqlBulkCopy(m.Conexion) { DestinationTableName = "dbo.Pedidos" };
        foreach (System.Data.DataColumn c in t.Columns) bulk.ColumnMappings.Add(c.ColumnName, c.ColumnName);
        bulk.WriteToServer(t);
        return t.Rows.Count;
    }
}

// ---------- 9. Actualizar y borrar ----------
if (Va("actualizar"))
{
    void Reponer() { Sql("UPDATE dbo.Pedidos SET Estado = 'Nuevo' WHERE PedidoId <= 10000"); }
    m.Medir("actualizar", "10.000 pedidos: cargar, cambiar Estado en el foreach y SaveChanges", () =>
    {
        using var ctx = m.Contexto();
        var l = ctx.Pedidos.Where(p => p.PedidoId <= 10000).ToList();
        foreach (var p in l) p.Estado = "Enviado";
        return ctx.SaveChanges();
    }, antesDeCada: Reponer, repeticiones: 3);
    m.Medir("actualizar", "10.000 pedidos: ExecuteUpdate(s => s.SetProperty(p => p.Estado, \"Enviado\"))", () =>
    {
        using var ctx = m.Contexto();
        return ctx.Pedidos.Where(p => p.PedidoId <= 10000).ExecuteUpdate(s => s.SetProperty(p => p.Estado, "Enviado"));
    }, antesDeCada: Reponer);
    Reponer();
    Sql("IF OBJECT_ID('dbo.EventosCopia') IS NOT NULL DROP TABLE dbo.EventosCopia; SELECT * INTO dbo.EventosCopia FROM dbo.Eventos WHERE PedidoId > 390000");
    void ReponerEventos() { Sql("DELETE FROM dbo.Eventos WHERE PedidoId > 390000; SET IDENTITY_INSERT dbo.Eventos ON; INSERT INTO dbo.Eventos (EventoId, PedidoId, Fecha, Tipo) SELECT EventoId, PedidoId, Fecha, Tipo FROM dbo.EventosCopia; SET IDENTITY_INSERT dbo.Eventos OFF"); }
    m.Medir("actualizar", "Borrar los eventos de 10.000 pedidos: cargar, RemoveRange y SaveChanges", () =>
    {
        using var ctx = m.Contexto();
        var l = ctx.Eventos.Where(e => e.PedidoId > 390000).ToList();
        ctx.Eventos.RemoveRange(l);
        return ctx.SaveChanges();
    }, antesDeCada: ReponerEventos, repeticiones: 3);
    m.Medir("actualizar", "Borrar los eventos de 10.000 pedidos: ExecuteDelete()", () =>
    {
        using var ctx = m.Contexto();
        return ctx.Eventos.Where(e => e.PedidoId > 390000).ExecuteDelete();
    }, antesDeCada: ReponerEventos);
    ReponerEventos();
    Sql("DROP TABLE dbo.EventosCopia");
}

// ---------- 10. Buscar por clave ----------
if (Va("clave"))
{
    var ids = IdsAlAzar(2000);
    var compilada = EF.CompileQuery((TiendaContext ctx, int id) => ctx.Pedidos.First(p => p.PedidoId == id));
    var fabrica = new PooledDbContextFactory<TiendaContext>(m.OpcionesDe<TiendaContext>());
    m.Medir("clave", "2.000 búsquedas: new TiendaContext + Find(id)", () => { decimal s = 0; foreach (var id in ids) { using var ctx = new TiendaContext(opciones); s += ctx.Pedidos.Find(id)!.Total; } return s; });
    m.Medir("clave", "2.000 búsquedas: new TiendaContext + First(p => p.PedidoId == id)", () => { decimal s = 0; foreach (var id in ids) { using var ctx = new TiendaContext(opciones); s += ctx.Pedidos.First(p => p.PedidoId == id).Total; } return s; });
    m.Medir("clave", "2.000 búsquedas: new TiendaContext + AsNoTracking().First(…)", () => { decimal s = 0; foreach (var id in ids) { using var ctx = new TiendaContext(opciones); s += ctx.Pedidos.AsNoTracking().First(p => p.PedidoId == id).Total; } return s; });
    m.Medir("clave", "2.000 búsquedas: new TiendaContext + consulta compilada (EF.CompileQuery)", () => { decimal s = 0; foreach (var id in ids) { using var ctx = new TiendaContext(opciones); s += compilada(ctx, id).Total; } return s; });
    m.Medir("clave", "2.000 búsquedas: contexto del pool (PooledDbContextFactory) + First(…)", () => { decimal s = 0; foreach (var id in ids) { using var ctx = fabrica.CreateDbContext(); s += ctx.Pedidos.First(p => p.PedidoId == id).Total; } return s; });
    m.Medir("clave", "2.000 búsquedas: un solo contexto + First(…)", () => { decimal s = 0; using var ctx = new TiendaContext(opciones); foreach (var id in ids) s += ctx.Pedidos.First(p => p.PedidoId == id).Total; return s; });
    m.Medir("clave", "2.000 búsquedas: un solo contexto + Find(id)", () => { decimal s = 0; using var ctx = new TiendaContext(opciones); foreach (var id in ids) s += ctx.Pedidos.Find(id)!.Total; return s; });
    m.Medir("clave", "2.000 búsquedas: un solo contexto, los 2.000 ya rastreados (una consulta con Contains) + Find(id)", () => { decimal s = 0; using var ctx = new TiendaContext(opciones); ctx.Pedidos.Where(p => ids.Contains(p.PedidoId)).Load(); foreach (var id in ids) s += ctx.Pedidos.Find(id)!.Total; return s; });
    m.Medir("clave", "2.000 búsquedas: un solo contexto, los 2.000 ya rastreados + First(…) (igual va a la base)", () => { decimal s = 0; using var ctx = new TiendaContext(opciones); ctx.Pedidos.Where(p => ids.Contains(p.PedidoId)).Load(); foreach (var id in ids) s += ctx.Pedidos.First(p => p.PedidoId == id).Total; return s; });
    m.Medir("clave", "2.000 búsquedas: un solo contexto, los 2.000 ya rastreados + Local.FirstOrDefault(…) (sin ir a la base)", () => { decimal s = 0; using var ctx = new TiendaContext(opciones); ctx.Pedidos.Where(p => ids.Contains(p.PedidoId)).Load(); foreach (var id in ids) s += ctx.Pedidos.Local.FirstOrDefault(p => p.PedidoId == id)!.Total; return s; });
    m.Medir("clave", "2.000 búsquedas: Dapper QueryFirst", () => { decimal s = 0; foreach (var id in ids) s += m.Conexion.QueryFirst<decimal>("SELECT Total FROM dbo.Pedidos WHERE PedidoId = @id", new { id }); return s; });
    m.Medir("clave", "2.000 búsquedas: SqlCommand a mano", () =>
    {
        decimal s = 0;
        foreach (var id in ids)
        {
            using var cmd = new SqlCommand("SELECT Total FROM dbo.Pedidos WHERE PedidoId = @id", m.Conexion);
            cmd.Parameters.Add("@id", System.Data.SqlDbType.Int).Value = id;
            s += (decimal)cmd.ExecuteScalar()!;
        }
        return s;
    });
}

// ---------- 11. Texto, varchar y el índice ----------
if (Va("varchar"))
{
    string email = "cliente31416@ejemplo.com.ar";
    m.Medir("varchar", "Where(c => c.Email == email), con IsUnicode(false) en el modelo (parámetro varchar)", () => { using var ctx = m.Contexto(false); return ctx.Clientes.Where(c => c.Email == email).Select(c => c.ClienteId).Single(); });
    m.Medir("varchar", "Where(c => c.Email == email), sin IsUnicode(false) (parámetro nvarchar contra columna varchar)", () => { using var ctx = new TiendaContextNvarchar(m.Opciones()); ctx.ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking; return ctx.Clientes.Where(c => c.Email == email).Select(c => c.ClienteId).Single(); });
    m.Medir("varchar", "Where(c => c.Email.StartsWith(\"cliente31416@\"))", () => { using var ctx = m.Contexto(false); return ctx.Clientes.Where(c => c.Email.StartsWith("cliente31416@")).Select(c => c.ClienteId).Single(); });
    m.Medir("varchar", "Where(c => c.Email.Contains(\"31416@\"))", () => { using var ctx = m.Contexto(false); return ctx.Clientes.Where(c => c.Email.Contains("31416@")).Select(c => c.ClienteId).Single(); });
    m.Medir("varchar", "Where(c => c.Email.EndsWith(\"e31416@ejemplo.com.ar\"))", () => { using var ctx = m.Contexto(false); return ctx.Clientes.Where(c => c.Email.EndsWith("e31416@ejemplo.com.ar")).Select(c => c.ClienteId).Single(); });
    m.Medir("varchar", "Where(c => c.Email.ToLower() == email.ToLower())", () => { using var ctx = m.Contexto(false); return ctx.Clientes.Where(c => c.Email.ToLower() == email.ToLower()).Select(c => c.ClienteId).Single(); });
    m.Medir("varchar", "Where(c => EF.Functions.Like(c.Email, \"cliente31416@%\"))", () => { using var ctx = m.Contexto(false); return ctx.Clientes.Where(c => EF.Functions.Like(c.Email, "cliente31416@%")).Select(c => c.ClienteId).Single(); });
    m.Medir("varchar", "Where(c => c.Email.Trim() == email)", () => { using var ctx = m.Contexto(false); return ctx.Clientes.Where(c => c.Email.Trim() == email).Select(c => c.ClienteId).Single(); });
}

// ---------- 12. Constantes y la caché de planes ----------
if (Va("constantes"))
{
    var valores = Enumerable.Range(0, 300).Select(i => 1000m + i * 17).ToArray();
    int Planes() => Escalar<int>("SELECT COUNT(*) FROM sys.dm_exec_cached_plans cp CROSS APPLY sys.dm_exec_sql_text(cp.plan_handle) t WHERE (t.text LIKE '%[[]Pedidos]%' OR t.text LIKE '%dbo.Pedidos%') AND t.text NOT LIKE '%dm_exec_cached_plans%'");
    void Vaciar() => Sql("DBCC FREEPROCCACHE WITH NO_INFOMSGS");
    Resultado r;
    r = m.Medir("constantes", "300 consultas con FromSqlRaw($\"… WHERE Total > {total}\") (el valor pegado en el SQL)", () => { using var ctx = m.Contexto(false); int n = 0; foreach (var v in valores) n += ctx.Pedidos.FromSqlRaw($"SELECT TOP 10 * FROM dbo.Pedidos WHERE ClienteId = 1 AND Total > {v.ToString(System.Globalization.CultureInfo.InvariantCulture)}").Count(); return n; }, antesDeCada: Vaciar);
    m.Resultados[^1] = r with { Nota = $"planes en caché al terminar: {Planes()}" };
    r = m.Medir("constantes", "300 consultas con FromSql($\"… WHERE Total > {total}\") (interpolado: parámetro)", () => { using var ctx = m.Contexto(false); int n = 0; foreach (var v in valores) n += ctx.Pedidos.FromSql($"SELECT TOP 10 * FROM dbo.Pedidos WHERE ClienteId = 1 AND Total > {v}").Count(); return n; }, antesDeCada: Vaciar);
    m.Resultados[^1] = r with { Nota = $"planes en caché al terminar: {Planes()}" };
    r = m.Medir("constantes", "300 consultas LINQ: Where(p => p.ClienteId == 1 && p.Total > total).Take(10).Count()", () => { using var ctx = m.Contexto(false); int n = 0; foreach (var v in valores) { var total = v; n += ctx.Pedidos.Where(p => p.ClienteId == 1 && p.Total > total).Take(10).Count(); } return n; }, antesDeCada: Vaciar);
    m.Resultados[^1] = r with { Nota = $"planes en caché al terminar: {Planes()}" };
    r = m.Medir("constantes", "300 consultas LINQ armadas con Expression.Constant (el valor como constante del árbol)", () =>
    {
        using var ctx = m.Contexto(false); int n = 0;
        foreach (var v in valores)
        {
            var p = System.Linq.Expressions.Expression.Parameter(typeof(Pedido), "p");
            var cuerpo = System.Linq.Expressions.Expression.AndAlso(
                System.Linq.Expressions.Expression.Equal(System.Linq.Expressions.Expression.Property(p, nameof(Pedido.ClienteId)), System.Linq.Expressions.Expression.Constant(1)),
                System.Linq.Expressions.Expression.GreaterThan(System.Linq.Expressions.Expression.Property(p, nameof(Pedido.Total)), System.Linq.Expressions.Expression.Constant(v)));
            var filtro = System.Linq.Expressions.Expression.Lambda<Func<Pedido, bool>>(cuerpo, p);
            n += ctx.Pedidos.Where(filtro).Take(10).Count();
        }
        return n;
    }, antesDeCada: Vaciar);
    m.Resultados[^1] = r with { Nota = $"planes en caché al terminar: {Planes()}" };
}

// ---------- 13. Sincrónico y asincrónico ----------
if (Va("async"))
{
    m.Medir("async", "500 documentos de 80 KB: ToList()", () => { using var ctx = m.Contexto(false); return ctx.Documentos.ToList().Sum(d => d.Cuerpo.Length); });
    await m.MedirAsync("async", "500 documentos de 80 KB: await ToListAsync()", async () => { using var ctx = m.Contexto(false); return (await ctx.Documentos.ToListAsync()).Sum(d => d.Cuerpo.Length); });
    await m.MedirAsync("async", "500 documentos: await ToListAsync() trayendo solo Titulo", async () => { using var ctx = m.Contexto(false); return (await ctx.Documentos.Select(d => new { d.DocumentoId, d.Titulo }).ToListAsync()).Count; });
    m.Medir("async", "20.000 pedidos: ToList()", () => { using var ctx = m.Contexto(false); return ctx.Pedidos.Where(p => p.PedidoId <= 20000).ToList().Count; });
    await m.MedirAsync("async", "20.000 pedidos: await ToListAsync()", async () => { using var ctx = m.Contexto(false); return (await ctx.Pedidos.Where(p => p.PedidoId <= 20000).ToListAsync()).Count; });
    m.Medir("async", "Un pedido por clave: First(…)", () => { using var ctx = m.Contexto(false); return ctx.Pedidos.First(p => p.PedidoId == 1234).Total; });
    await m.MedirAsync("async", "Un pedido por clave: await FirstAsync(…)", async () => { using var ctx = m.Contexto(false); return (await ctx.Pedidos.FirstAsync(p => p.PedidoId == 1234)).Total; });
}

// ---------- salida ----------
var entorno = new
{
    dotnet = Environment.Version.ToString(),
    efcore = typeof(DbContext).Assembly.GetName().Version!.ToString(3),
    sqlclient = typeof(SqlConnection).Assembly.GetName().Version!.ToString(3),
    dapper = typeof(SqlMapper).Assembly.GetName().Version!.ToString(3),
    sqlserver = Escalar<string>("SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(50)) + ' ' + CAST(SERVERPROPERTY('Edition') AS nvarchar(100))"),
    cpus = Environment.ProcessorCount,
    so = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
    fecha = DateTime.UtcNow.ToString("yyyy-MM-dd")
};
var baseDatos = new { clientes = Carga.Clientes, productos = Carga.Productos, pedidos = Carga.Pedidos, items = Escalar<int>("SELECT COUNT(*) FROM dbo.Items"), eventos = Escalar<int>("SELECT COUNT(*) FROM dbo.Eventos"), documentos = Carga.Documentos, pedidosCliente1 = Carga.PedidosCliente1, pedidosCliente2 = Carga.PedidosCliente2, pedidosCliente3 = Carga.PedidosCliente3 };
var anteriores = new Dictionary<string, List<Resultado>>();
if (solo.Count > 0 && File.Exists(salida))
    anteriores = JsonSerializer.Deserialize<JsonElement>(File.ReadAllText(salida)).GetProperty("capitulos").Deserialize<Dictionary<string, List<Resultado>>>(new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
foreach (var g in m.Resultados.GroupBy(r => r.Capitulo)) anteriores[g.Key] = g.ToList();
var json = JsonSerializer.Serialize(new { entorno, baseDatos, repeticiones = m.Repeticiones, capitulos = anteriores }, new JsonSerializerOptions { WriteIndented = true, PropertyNamingPolicy = JsonNamingPolicy.CamelCase, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
File.WriteAllText(salida, json);
Console.WriteLine($"Guardado {salida} con {m.Resultados.Count} mediciones");

public record PedidoResumen(int PedidoId, DateTime Fecha, string Estado, decimal Total);
