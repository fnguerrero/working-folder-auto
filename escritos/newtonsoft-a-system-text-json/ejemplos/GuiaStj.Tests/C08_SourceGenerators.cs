namespace GuiaStj.Tests;

public record Producto(int Id, string Nombre, Categoria Categoria);
public record NoRegistrado(int X);

[JsonConverter(typeof(JsonStringEnumConverter<Categoria>))]
public enum Categoria { Almacen, Limpieza }

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(Producto))]
[JsonSerializable(typeof(List<Producto>))]
internal partial class CatalogoContext : JsonSerializerContext { }

[JsonSerializable(typeof(NoRegistrado))]
internal partial class OtroContext : JsonSerializerContext { }

public class C08_SourceGenerators
{
    private static readonly Producto Yerba = new(1, "Yerba", Categoria.Almacen);
    private const string YerbaJson = """{"id":1,"nombre":"Yerba","categoria":"Almacen"}""";

    [Fact]
    public void T0801_Mismo_JSON_con_el_contexto_generado()
    {
        var nj = new NJ.JsonSerializerSettings
        {
            ContractResolver = new NJS.CamelCasePropertyNamesContractResolver(),
            Converters = { new NJC.StringEnumConverter() }
        };
        Assert.Equal(YerbaJson, Json.Nj(Yerba, nj));
        Assert.Equal(YerbaJson, Stj.Serialize(Yerba, CatalogoContext.Default.Producto));
        Assert.Equal(Yerba, Stj.Deserialize(YerbaJson, CatalogoContext.Default.Producto));
        Assert.Equal($"[{YerbaJson}]", Stj.Serialize(new List<Producto> { Yerba }, CatalogoContext.Default.ListProducto));
    }

    [Fact]
    public void T0802_Opciones_nuevas_apuntando_al_contexto()
    {
        var o = new JsonSerializerOptions { TypeInfoResolver = CatalogoContext.Default };
        // Las opciones del atributo no pasan a unas JsonSerializerOptions nuevas
        Assert.Equal("""{"Id":1,"Nombre":"Yerba","Categoria":"Almacen"}""", Stj.Serialize(Yerba, o));
        Assert.Equal(YerbaJson, Stj.Serialize(Yerba, typeof(Producto), CatalogoContext.Default));
        Assert.Equal(YerbaJson, Stj.Serialize(Yerba, CatalogoContext.Default.Options));
    }

    [Fact]
    public void T0803_Tipo_no_registrado()
    {
        var o = new JsonSerializerOptions { TypeInfoResolver = CatalogoContext.Default };
        Assert.Throws<NotSupportedException>(() => Stj.Serialize(new NoRegistrado(1), o));
    }

    [Fact]
    public void T0804_Combinar_contextos()
    {
        var o = new JsonSerializerOptions { TypeInfoResolver = JsonTypeInfoResolver.Combine(CatalogoContext.Default, OtroContext.Default) };
        Assert.Equal("""{"X":1}""", Stj.Serialize(new NoRegistrado(1), o));

        var cadena = new JsonSerializerOptions();
        cadena.TypeInfoResolverChain.Add(CatalogoContext.Default);
        cadena.TypeInfoResolverChain.Add(OtroContext.Default);
        Assert.Equal("""{"X":1}""", Stj.Serialize(new NoRegistrado(1), cadena));
    }

    [Fact]
    public void T0805_Tipo_anonimo_no_esta_en_el_contexto()
    {
        var o = new JsonSerializerOptions { TypeInfoResolver = CatalogoContext.Default };
        Assert.Throws<NotSupportedException>(() => Stj.Serialize(new { A = 1 }, o));
    }
}
