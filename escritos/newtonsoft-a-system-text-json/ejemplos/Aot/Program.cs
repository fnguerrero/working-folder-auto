using System.Text.Json;
using System.Text.Json.Serialization;

var yerba = new Producto(1, "Yerba", Categoria.Almacen);
var fallas = 0;

var json = JsonSerializer.Serialize(yerba, CatalogoContext.Default.Producto);
Verificar("serializa con el contexto", json == """{"id":1,"nombre":"Yerba","categoria":"Almacen"}""");
Verificar("deserializa con el contexto", JsonSerializer.Deserialize(json, CatalogoContext.Default.Producto) == yerba);
Verificar("la reflexion esta apagada", !JsonSerializer.IsReflectionEnabledByDefault);

try
{
#pragma warning disable IL2026, IL3050 // a propósito: es lo que no hay que hacer
    JsonSerializer.Serialize(yerba);
#pragma warning restore IL2026, IL3050
    Verificar("sin contexto falla", false);
}
catch (InvalidOperationException)
{
    Verificar("sin contexto falla", true);
}

return fallas;

void Verificar(string caso, bool ok)
{
    Console.WriteLine($"{(ok ? "OK " : "MAL")} {caso}");
    if (!ok) fallas++;
}

public record Producto(int Id, string Nombre, Categoria Categoria);

[JsonConverter(typeof(JsonStringEnumConverter<Categoria>))]
public enum Categoria { Almacen, Limpieza }

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(Producto))]
internal partial class CatalogoContext : JsonSerializerContext { }
