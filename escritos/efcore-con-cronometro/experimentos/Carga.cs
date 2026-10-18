using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Experimentos;

/// <summary>Crea la base «Tienda» y la llena con SqlBulkCopy (es el mismo esquema de «Índices con el cronómetro»,
/// más Eventos, Notas en Pedidos y una tabla Documentos con textos grandes).</summary>
public static class Carga
{
    public const int Clientes = 50_000, Productos = 2_000, Pedidos = 400_000, Documentos = 500;
    public const int PedidosCliente1 = 100_000, PedidosCliente2 = 200, PedidosCliente3 = 500;

    public static void Crear(string cs)
    {
        using var maestro = new SqlConnection(cs.Replace("Database=Tienda", "Database=master"));
        maestro.Open();
        new SqlCommand("IF DB_ID('Tienda') IS NOT NULL BEGIN ALTER DATABASE Tienda SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE Tienda; END; CREATE DATABASE Tienda;", maestro).ExecuteNonQuery();
        maestro.Close();

        var opciones = new DbContextOptionsBuilder().UseSqlServer(cs).Options;
        using (var ctx = new TiendaContext(opciones)) ctx.Database.EnsureCreated();

        var azar = new Random(2026);
        using var con = new SqlConnection(cs);
        con.Open();

        var clientes = Tabla(("ClienteId", typeof(int)), ("Nombre", typeof(string)), ("Email", typeof(string)), ("Alta", typeof(DateTime)));
        for (int i = 1; i <= Clientes; i++) clientes.Rows.Add(i, $"Cliente {i}", $"cliente{i}@ejemplo.com.ar", new DateTime(2018, 1, 1).AddDays(azar.Next(2500)));
        Volcar(con, "Clientes", clientes);

        var productos = Tabla(("ProductoId", typeof(int)), ("Nombre", typeof(string)), ("Precio", typeof(decimal)));
        for (int i = 1; i <= Productos; i++) productos.Rows.Add(i, $"Producto {i}", Math.Round((decimal)(azar.NextDouble() * 50000 + 100), 2));
        Volcar(con, "Productos", productos);

        var pedidos = Tabla(("PedidoId", typeof(int)), ("ClienteId", typeof(int)), ("Fecha", typeof(DateTime)), ("Estado", typeof(string)), ("Total", typeof(decimal)), ("Notas", typeof(string)));
        var items = Tabla(("ItemId", typeof(int)), ("PedidoId", typeof(int)), ("ProductoId", typeof(int)), ("Cantidad", typeof(int)), ("Precio", typeof(decimal)));
        var eventos = Tabla(("EventoId", typeof(int)), ("PedidoId", typeof(int)), ("Fecha", typeof(DateTime)), ("Tipo", typeof(string)));
        string[] estados = { "Nuevo", "Pagado", "Enviado", "Entregado", "Cancelado" };
        string[] tipos = { "Creado", "Pagado", "Preparado", "Despachado", "Entregado", "Reclamo" };
        string[] palabras = "entrega en portería llamar antes timbre roto dejar con el encargado horario de tarde sin cambio factura A cuit consumidor final envolver para regalo frágil no apilar".Split(' ');
        int itemId = 1, eventoId = 1;
        for (int i = 1; i <= Pedidos; i++)
        {
            int cliente = i <= PedidosCliente1 ? 1 : i <= PedidosCliente1 + PedidosCliente2 ? 2 : i <= PedidosCliente1 + PedidosCliente2 + PedidosCliente3 ? 3 : azar.Next(4, Clientes + 1);
            var fecha = new DateTime(2022, 1, 1).AddMinutes(i * 4.5);
            int cant = azar.Next(1, 6);
            decimal total = 0;
            for (int k = 0; k < cant; k++)
            {
                int prod = azar.Next(1, Productos + 1); int cantidad = azar.Next(1, 4);
                decimal precio = (decimal)productos.Rows[prod - 1]["Precio"];
                items.Rows.Add(itemId++, i, prod, cantidad, precio); total += precio * cantidad;
            }
            int nEv = azar.Next(2, 7);
            for (int k = 0; k < nEv; k++) eventos.Rows.Add(eventoId++, i, fecha.AddHours(k * 6), tipos[Math.Min(k, tipos.Length - 1)]);
            var notas = new System.Text.StringBuilder();
            int nPal = azar.Next(20, 60);
            for (int k = 0; k < nPal; k++) notas.Append(palabras[azar.Next(palabras.Length)]).Append(' ');
            pedidos.Rows.Add(i, cliente, fecha, estados[azar.Next(estados.Length)], Math.Round(total, 2), notas.ToString());
        }
        Volcar(con, "Pedidos", pedidos); Volcar(con, "Items", items); Volcar(con, "Eventos", eventos);

        var docs = Tabla(("DocumentoId", typeof(int)), ("Titulo", typeof(string)), ("Cuerpo", typeof(string)));
        for (int i = 1; i <= Documentos; i++)
        {
            var sb = new System.Text.StringBuilder();
            while (sb.Length < 40_000) sb.Append(palabras[azar.Next(palabras.Length)]).Append(' ');
            docs.Rows.Add(i, $"Documento {i}", sb.ToString());
        }
        Volcar(con, "Documentos", docs);
        foreach (var t in new[] { "Clientes", "Productos", "Pedidos", "Items", "Eventos", "Documentos" })
            new SqlCommand($"UPDATE STATISTICS dbo.{t} WITH FULLSCAN", con) { CommandTimeout = 600 }.ExecuteNonQuery();
        Console.WriteLine($"Base cargada: {Clientes} clientes, {Pedidos} pedidos, {items.Rows.Count} ítems, {eventos.Rows.Count} eventos, {Documentos} documentos");
    }

    static DataTable Tabla(params (string, Type)[] cols)
    {
        var t = new DataTable();
        foreach (var (n, tipo) in cols) t.Columns.Add(n, tipo);
        return t;
    }

    static void Volcar(SqlConnection con, string tabla, DataTable datos)
    {
        using var bulk = new SqlBulkCopy(con, SqlBulkCopyOptions.KeepIdentity | SqlBulkCopyOptions.TableLock, null) { DestinationTableName = "dbo." + tabla, BatchSize = 50_000, BulkCopyTimeout = 600 };
        bulk.WriteToServer(datos);
    }
}
