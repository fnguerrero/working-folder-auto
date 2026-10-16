using System.Text.Json;
using System.Text.Json.Serialization;
using BenchmarkDotNet.Attributes;

namespace Bench;

public class PedidoDto
{
    public int Id { get; set; } public int ClienteId { get; set; } public string Cliente { get; set; } = ""; public decimal Total { get; set; }
    public DateTime Fecha { get; set; } public string Estado { get; set; } = ""; public List<ItemDto> Items { get; set; } = new();
}
public class ItemDto { public int ProductoId { get; set; } public string Descripcion { get; set; } = ""; public int Cantidad { get; set; } public decimal Precio { get; set; } }

[JsonSerializable(typeof(PedidoDto))]
public partial class PedidoContexto : JsonSerializerContext { }

// Capítulo: JSON con Newtonsoft, System.Text.Json y source generator.
public class Json
{
    private readonly PedidoDto _pedido;
    private readonly string _json;
    private static readonly JsonSerializerOptions _opcionesWeb = new(JsonSerializerDefaults.Web);
    private static readonly JsonSerializerOptions _opcionesCache = new();
    public Json()
    {
        _pedido = new PedidoDto { Id = 4821, ClienteId = 17, Cliente = "Nicolás", Total = 12345.67m, Fecha = new DateTime(2026, 10, 16, 3, 0, 0, DateTimeKind.Utc), Estado = "aprobado",
            Items = Enumerable.Range(1, 5).Select(i => new ItemDto { ProductoId = i, Descripcion = $"Producto número {i}", Cantidad = i, Precio = 100m * i }).ToList() };
        _json = JsonSerializer.Serialize(_pedido);
    }
    [Benchmark(Baseline = true)] public string StjSerializar() => JsonSerializer.Serialize(_pedido);
    [Benchmark] public string StjSerializarOpcionesNuevas() => JsonSerializer.Serialize(_pedido, new JsonSerializerOptions { WriteIndented = false });
    [Benchmark] public string StjSerializarSourceGen() => JsonSerializer.Serialize(_pedido, PedidoContexto.Default.PedidoDto);
    [Benchmark] public string NewtonsoftSerializar() => Newtonsoft.Json.JsonConvert.SerializeObject(_pedido);
    [Benchmark] public PedidoDto StjDeserializar() => JsonSerializer.Deserialize<PedidoDto>(_json)!;
    [Benchmark] public PedidoDto StjDeserializarSourceGen() => JsonSerializer.Deserialize(_json, PedidoContexto.Default.PedidoDto)!;
    [Benchmark] public PedidoDto NewtonsoftDeserializar() => Newtonsoft.Json.JsonConvert.DeserializeObject<PedidoDto>(_json)!;
    [Benchmark] public byte[] StjSerializarBytes() => JsonSerializer.SerializeToUtf8Bytes(_pedido, _opcionesCache);
}
