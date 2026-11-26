using System.Runtime.Serialization;

namespace GuiaStj.Tests;

public class C04_Enums
{
    public enum Estado { Pendiente, EnCurso, Terminado }

    [Flags] public enum Permiso { Ninguno = 0, Leer = 1, Escribir = 2 }

    public enum ConEnumMember
    {
        [EnumMember(Value = "en_curso")] EnCurso
    }

    public enum ConNombreStj
    {
        [JsonStringEnumMemberName("en_curso")] EnCurso
    }

    public class Tarea { public Estado Estado { get; set; } }

    private static JsonSerializerOptions Con(JsonConverter c) => new() { Converters = { c } };
    private static NJ.JsonSerializerSettings ConNj(NJ.JsonConverter c) => new() { Converters = { c } };

    [Fact]
    public void T0401_Por_defecto_los_dos_escriben_el_numero()
    {
        var t = new Tarea { Estado = Estado.EnCurso };
        Assert.Equal("""{"Estado":1}""", Json.Nj(t));
        Assert.Equal("""{"Estado":1}""", Stj.Serialize(t));
        Assert.Equal("""{"estado":1}""", Stj.Serialize(t, JsonSerializerOptions.Web));
    }

    [Fact]
    public void T0402_Newtonsoft_lee_el_nombre_sin_configurar_nada_STJ_no()
    {
        const string json = """{"Estado":"EnCurso"}""";
        Assert.Equal(Estado.EnCurso, Json.DeNj<Tarea>(json)!.Estado);
        Assert.Throws<JsonException>(() => Stj.Deserialize<Tarea>(json));
        Assert.Throws<JsonException>(() => Stj.Deserialize<Tarea>(json, JsonSerializerOptions.Web));
    }

    [Fact]
    public void T0403_StringEnumConverter_contra_JsonStringEnumConverter()
    {
        var t = new Tarea { Estado = Estado.EnCurso };
        const string esperado = """{"Estado":"EnCurso"}""";
        Assert.Equal(esperado, Json.Nj(t, ConNj(new NJC.StringEnumConverter())));
        Assert.Equal(esperado, Stj.Serialize(t, Con(new JsonStringEnumConverter())));
        Assert.Equal(esperado, Stj.Serialize(t, Con(new JsonStringEnumConverter<Estado>())));
    }

    [Theory]
    [InlineData("\"encurso\"")]
    [InlineData("\"ENCURSO\"")]
    [InlineData("1")]
    [InlineData("\"1\"")]
    public void T0404_Lectura_tolerante_en_los_dos(string valor)
    {
        Assert.Equal(Estado.EnCurso, Json.DeNj<Estado>(valor, ConNj(new NJC.StringEnumConverter())));
        Assert.Equal(Estado.EnCurso, Stj.Deserialize<Estado>(valor, Con(new JsonStringEnumConverter())));
    }

    [Fact]
    public void T0405_Rechazar_numeros()
    {
        var nj = ConNj(new NJC.StringEnumConverter { AllowIntegerValues = false });
        var stj = Con(new JsonStringEnumConverter(namingPolicy: null, allowIntegerValues: false));
        Assert.Throws<NJ.JsonSerializationException>(() => Json.DeNj<Estado>("1", nj));
        Assert.Throws<JsonException>(() => Stj.Deserialize<Estado>("1", stj));
    }

    [Fact]
    public void T0406_Un_numero_fuera_de_rango_entra_en_los_dos()
    {
        Assert.Equal((Estado)99, Json.DeNj<Estado>("99"));
        Assert.Equal((Estado)99, Stj.Deserialize<Estado>("99"));
        Assert.Equal((Estado)99, Stj.Deserialize<Estado>("99", Con(new JsonStringEnumConverter())));
    }

    [Fact]
    public void T0407_Un_nombre_desconocido_falla_en_los_dos()
    {
        Assert.Throws<NJ.JsonSerializationException>(() => Json.DeNj<Estado>("\"Otro\""));
        Assert.Throws<JsonException>(() => Stj.Deserialize<Estado>("\"Otro\"", Con(new JsonStringEnumConverter())));
    }

    [Fact]
    public void T0408_CamelCase()
    {
        var nj = ConNj(new NJC.StringEnumConverter(new NJS.CamelCaseNamingStrategy()));
        var stj = Con(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        Assert.Equal("\"enCurso\"", Json.Nj(Estado.EnCurso, nj));
        Assert.Equal("\"enCurso\"", Stj.Serialize(Estado.EnCurso, stj));
    }

    [Fact]
    public void T0409_EnumMember_se_ignora_en_STJ()
    {
        Assert.Equal("\"en_curso\"", Json.Nj(ConEnumMember.EnCurso, ConNj(new NJC.StringEnumConverter())));
        Assert.Equal("\"EnCurso\"", Stj.Serialize(ConEnumMember.EnCurso, Con(new JsonStringEnumConverter())));
    }

    [Fact]
    public void T0410_JsonStringEnumMemberName()
    {
        var o = Con(new JsonStringEnumConverter());
        Assert.Equal("\"en_curso\"", Stj.Serialize(ConNombreStj.EnCurso, o));
        Assert.Equal(ConNombreStj.EnCurso, Stj.Deserialize<ConNombreStj>("\"en_curso\"", o));
    }

    [Fact]
    public void T0411_Flags()
    {
        var v = Permiso.Leer | Permiso.Escribir;
        Assert.Equal("\"Leer, Escribir\"", Json.Nj(v, ConNj(new NJC.StringEnumConverter())));
        Assert.Equal("\"Leer, Escribir\"", Stj.Serialize(v, Con(new JsonStringEnumConverter())));
        Assert.Equal(v, Stj.Deserialize<Permiso>("\"Leer, Escribir\"", Con(new JsonStringEnumConverter())));
    }

    [Fact]
    public void T0412_Enum_como_clave_de_diccionario()
    {
        var d = new Dictionary<Estado, int> { [Estado.EnCurso] = 1 };
        Assert.Equal("""{"EnCurso":1}""", Json.Nj(d));
        Assert.Equal("""{"EnCurso":1}""", Stj.Serialize(d));
        Assert.Equal(1, Stj.Deserialize<Dictionary<Estado, int>>("""{"EnCurso":1}""")![Estado.EnCurso]);
    }

    public class EstadoTolerante : JsonConverter<Estado>
    {
        public override Estado Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
        {
            if (reader.TokenType == JsonTokenType.String
                && Enum.TryParse<Estado>(reader.GetString(), ignoreCase: true, out var e)
                && Enum.IsDefined(e))
                return e;
            reader.Skip(); // consume objetos o arrays enteros
            return Estado.Pendiente;
        }

        public override void Write(Utf8JsonWriter writer, Estado value, JsonSerializerOptions o)
            => writer.WriteStringValue(value.ToString());
    }

    [Theory]
    [InlineData("\"Otro\"")]
    [InlineData("99")]
    [InlineData("\"99\"")]
    [InlineData("{\"a\":1}")]
    public void T0413_Valor_desconocido_con_fallback(string valor)
    {
        var t = Stj.Deserialize<Tarea>($$"""{"Estado":{{valor}}}""", Con(new EstadoTolerante()))!;
        Assert.Equal(Estado.Pendiente, t.Estado);
    }
}
