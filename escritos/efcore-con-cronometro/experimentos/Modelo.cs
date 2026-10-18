using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Data.SqlClient;

namespace Experimentos;

public class Cliente
{
    /// <summary>Para el experimento de tracking: con qué tipo se inicializa la colección de navegación.</summary>
    public static bool PedidosComoHashSet;
    public Cliente() { Pedidos = PedidosComoHashSet ? new HashSet<Pedido>() : new List<Pedido>(); }
    public int ClienteId { get; set; }
    public string Nombre { get; set; } = "";
    public string Email { get; set; } = "";
    public DateTime Alta { get; set; }
    public virtual ICollection<Pedido> Pedidos { get; set; }
}

public class Producto
{
    public int ProductoId { get; set; }
    public string Nombre { get; set; } = "";
    public decimal Precio { get; set; }
}

public class Pedido
{
    public int PedidoId { get; set; }
    public int ClienteId { get; set; }
    public virtual Cliente Cliente { get; set; } = null!;
    public DateTime Fecha { get; set; }
    public string Estado { get; set; } = "Nuevo";
    public decimal Total { get; set; }
    public string? Notas { get; set; }
    public virtual ICollection<Item> Items { get; set; } = new List<Item>();
    public virtual ICollection<Evento> Eventos { get; set; } = new List<Evento>();
}

public class Item
{
    public int ItemId { get; set; }
    public int PedidoId { get; set; }
    public int ProductoId { get; set; }
    public int Cantidad { get; set; }
    public decimal Precio { get; set; }
}

public class Evento
{
    public int EventoId { get; set; }
    public int PedidoId { get; set; }
    public DateTime Fecha { get; set; }
    public string Tipo { get; set; } = "";
}

public class Documento
{
    public int DocumentoId { get; set; }
    public string Titulo { get; set; } = "";
    public string Cuerpo { get; set; } = "";
}

/// <summary>El contexto bien mapeado: Email y Estado son varchar, como en la base.</summary>
public class TiendaContext : DbContext
{
    public TiendaContext(DbContextOptions options) : base(options) { }
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Producto> Productos => Set<Producto>();
    public DbSet<Pedido> Pedidos => Set<Pedido>();
    public DbSet<Item> Items => Set<Item>();
    public DbSet<Evento> Eventos => Set<Evento>();
    public DbSet<Documento> Documentos => Set<Documento>();

    protected virtual bool EmailComoVarchar => true;

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Cliente>(e =>
        {
            e.Property(c => c.Nombre).HasMaxLength(100);
            var email = e.Property(c => c.Email).HasMaxLength(200);
            if (EmailComoVarchar) email.IsUnicode(false);
            e.HasIndex(c => c.Email).IsUnique();
        });
        mb.Entity<Producto>(e => { e.Property(p => p.Nombre).HasMaxLength(100); e.Property(p => p.Precio).HasPrecision(18, 2); });
        mb.Entity<Pedido>(e =>
        {
            e.Property(p => p.Estado).HasMaxLength(20).IsUnicode(false);
            e.Property(p => p.Total).HasPrecision(18, 2);
            e.HasIndex(p => p.ClienteId);
            e.HasIndex(p => p.Fecha);
            e.HasMany(p => p.Items).WithOne().HasForeignKey(i => i.PedidoId);
            e.HasMany(p => p.Eventos).WithOne().HasForeignKey(i => i.PedidoId);
        });
        mb.Entity<Item>(e => { e.Property(i => i.Precio).HasPrecision(18, 2); e.HasIndex(i => i.PedidoId); });
        mb.Entity<Evento>(e => { e.Property(v => v.Tipo).HasMaxLength(20).IsUnicode(false); e.HasIndex(v => v.PedidoId); });
        mb.Entity<Documento>(e => e.Property(d => d.Titulo).HasMaxLength(200));
    }
}

/// <summary>El mismo modelo pero sin decir que Email es varchar: EF manda el parámetro como nvarchar.</summary>
public class TiendaContextNvarchar : TiendaContext
{
    public TiendaContextNvarchar(DbContextOptions options) : base(options) { }
    protected override bool EmailComoVarchar => false;
}

/// <summary>Cuenta comandos y guarda los SQL distintos que mandó EF.</summary>
public class Captura : DbCommandInterceptor
{
    public int Comandos;
    public List<string> Sql = new();
    public void Reset() { Comandos = 0; Sql.Clear(); }
    void Anotar(System.Data.Common.DbCommand c)
    {
        Comandos++;
        if (Sql.Count < 3 && !Sql.Contains(c.CommandText)) Sql.Add(c.CommandText);
    }
    public override InterceptionResult<System.Data.Common.DbDataReader> ReaderExecuting(System.Data.Common.DbCommand command, CommandEventData eventData, InterceptionResult<System.Data.Common.DbDataReader> result) { Anotar(command); return result; }
    public override ValueTask<InterceptionResult<System.Data.Common.DbDataReader>> ReaderExecutingAsync(System.Data.Common.DbCommand command, CommandEventData eventData, InterceptionResult<System.Data.Common.DbDataReader> result, CancellationToken ct = default) { Anotar(command); return ValueTask.FromResult(result); }
    public override InterceptionResult<int> NonQueryExecuting(System.Data.Common.DbCommand command, CommandEventData eventData, InterceptionResult<int> result) { Anotar(command); return result; }
    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(System.Data.Common.DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken ct = default) { Anotar(command); return ValueTask.FromResult(result); }
    public override InterceptionResult<object> ScalarExecuting(System.Data.Common.DbCommand command, CommandEventData eventData, InterceptionResult<object> result) { Anotar(command); return result; }
    public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(System.Data.Common.DbCommand command, CommandEventData eventData, InterceptionResult<object> result, CancellationToken ct = default) { Anotar(command); return ValueTask.FromResult(result); }
}
