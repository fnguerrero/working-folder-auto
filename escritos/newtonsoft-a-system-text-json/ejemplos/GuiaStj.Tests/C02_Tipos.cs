using System.ComponentModel;
using System.Globalization;
using System.Numerics;

namespace GuiaStj.Tests;

public class C02_Tipos
{
    public class Numeros { public int N { get; set; } }
    public class Texto { public string? S { get; set; } }
    public class Booleano { public bool B { get; set; } }
    public class Anulable { public int? N { get; set; } }
    public class NoAnulable { public string Nombre { get; set; } = "x"; }
    public class Obligatorio { public required string Nombre { get; set; } }
    public class Grande { public BigInteger N { get; set; } }

    public class ConDefault
    {
        public string Moneda { get; set; } = "ARS";
        public string? Nota { get; set; }
    }

    public class Valores
    {
        public int N { get; set; }
        public bool B { get; set; }
        public string? S { get; set; }
        [DefaultValue(10)] public int Diez { get; set; } = 10;
    }

    [Fact]
    public void T0201_Null_en_un_int_falla_en_los_dos()
    {
        Assert.Throws<NJ.JsonSerializationException>(() => Json.DeNj<Numeros>("""{"N":null}"""));
        Assert.Throws<JsonException>(() => Stj.Deserialize<Numeros>("""{"N":null}"""));
    }

    [Fact]
    public void T0202_Ignorar_nulos_al_escribir()
    {
        var v = new ConDefault();
        const string esperado = """{"Moneda":"ARS"}""";
        Assert.Equal(esperado, Json.Nj(v, new() { NullValueHandling = NJ.NullValueHandling.Ignore }));
        Assert.Equal(esperado, Stj.Serialize(v, new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull }));
    }

    [Fact]
    public void T0203_NullValueHandling_Ignore_tambien_actua_al_leer_en_Newtonsoft()
    {
        const string json = """{"Moneda":null}""";
        var nj = new NJ.JsonSerializerSettings { NullValueHandling = NJ.NullValueHandling.Ignore };
        Assert.Equal("ARS", Json.DeNj<ConDefault>(json, nj)!.Moneda);

        var stj = new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
        Assert.Null(Stj.Deserialize<ConDefault>(json, stj)!.Moneda); // pisa el valor inicial
    }

    internal static void IgnorarNullAlLeer(JsonTypeInfo info)
    {
        foreach (var p in info.Properties)
        {
            var set = p.Set;
            if (set is null || p.PropertyType.IsValueType) continue;
            p.Set = (obj, valor) => { if (valor is not null) set(obj, valor); };
        }
    }

    [Fact]
    public void T0204_Modificador_que_ignora_nulos_al_leer()
    {
        var o = new JsonSerializerOptions
        {
            TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { IgnorarNullAlLeer } }
        };
        Assert.Equal("ARS", Stj.Deserialize<ConDefault>("""{"Moneda":null}""", o)!.Moneda);
    }

    [Fact]
    public void T0205_Null_en_referencia_no_anulable()
    {
        const string json = """{"Nombre":null}""";
        Assert.Null(Json.DeNj<NoAnulable>(json)!.Nombre);
        Assert.Null(Stj.Deserialize<NoAnulable>(json)!.Nombre);
        Assert.Throws<JsonException>(() => Stj.Deserialize<NoAnulable>(json,
            new JsonSerializerOptions { RespectNullableAnnotations = true }));
    }

    [Fact]
    public void T0206_Palabra_clave_required()
    {
        Assert.Null(Json.DeNj<Obligatorio>("{}")!.Nombre);
        Assert.Throws<JsonException>(() => Stj.Deserialize<Obligatorio>("{}"));
        // Exige la presencia, no que sea distinto de null
        Assert.Null(Stj.Deserialize<Obligatorio>("""{"Nombre":null}""")!.Nombre);
    }

    [Fact]
    public void T0207_Ignorar_valores_por_defecto()
    {
        var v = new Valores();
        // Newtonsoft respeta [DefaultValue(10)]
        Assert.Equal("{}", Json.Nj(v, new() { DefaultValueHandling = NJ.DefaultValueHandling.Ignore }));
        // STJ compara contra default(T) y no mira [DefaultValue]
        var o = new JsonSerializerOptions { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingDefault };
        Assert.Equal("""{"Diez":10}""", Stj.Serialize(v, o));
    }

    [Fact]
    public void T0208_Numero_entre_comillas()
    {
        const string json = """{"N":"42"}""";
        Assert.Equal(42, Json.DeNj<Numeros>(json)!.N);
        Assert.Throws<JsonException>(() => Stj.Deserialize<Numeros>(json));
        Assert.Equal(42, Stj.Deserialize<Numeros>(json, JsonSerializerOptions.Web)!.N);
        Assert.Equal(42, Stj.Deserialize<Numeros>(json,
            new JsonSerializerOptions { NumberHandling = JsonNumberHandling.AllowReadingFromString })!.N);
    }

    [Theory]
    [InlineData("""{"S":123}""", "123")]
    [InlineData("""{"S":true}""", "true")]
    public void T0209_Numero_o_booleano_en_un_string(string json, string esperadoNj)
    {
        Assert.Equal(esperadoNj, Json.DeNj<Texto>(json)!.S);
        Assert.Throws<JsonException>(() => Stj.Deserialize<Texto>(json));
        Assert.Throws<JsonException>(() => Stj.Deserialize<Texto>(json, JsonSerializerOptions.Web));
    }

    [Theory]
    [InlineData("""{"B":"true"}""")]
    [InlineData("""{"B":1}""")]
    public void T0210_Booleano_como_texto_o_numero(string json)
    {
        Assert.True(Json.DeNj<Booleano>(json)!.B);
        Assert.Throws<JsonException>(() => Stj.Deserialize<Booleano>(json, JsonSerializerOptions.Web));
    }

    [Fact]
    public void T0211_String_vacio_en_un_int_anulable()
    {
        const string json = """{"N":""}""";
        Assert.Null(Json.DeNj<Anulable>(json)!.N);
        Assert.Throws<JsonException>(() => Stj.Deserialize<Anulable>(json, JsonSerializerOptions.Web));
    }

    [Fact]
    public void T0212_Decimal_en_un_int_falla_en_los_dos()
    {
        Assert.Throws<NJ.JsonReaderException>(() => Json.DeNj<Numeros>("""{"N":1.5}"""));
        Assert.Throws<JsonException>(() => Stj.Deserialize<Numeros>("""{"N":1.5}"""));
    }

    [Fact]
    public void T0213_Entero_en_object()
    {
        var nj = Json.DeNj<Dictionary<string, object>>("""{"n":5}""")!;
        Assert.IsType<long>(nj["n"]);

        var stj = Stj.Deserialize<Dictionary<string, object>>("""{"n":5}""")!;
        var elemento = Assert.IsType<JsonElement>(stj["n"]);
        Assert.Equal(5, elemento.GetInt32());
        Assert.Throws<InvalidCastException>(() => Convert.ToInt64(stj["n"]));
    }

    [Fact]
    public void T0214_Entero_mas_grande_que_long()
    {
        const string json = """{"n":123456789012345678901234567890}""";

        var nj = Json.DeNj<Dictionary<string, object>>(json)!;
        Assert.IsType<BigInteger>(nj["n"]);

        var elemento = (JsonElement)Stj.Deserialize<Dictionary<string, object>>(json)!["n"];
        Assert.False(elemento.TryGetInt64(out _));
        Assert.Equal("123456789012345678901234567890", elemento.GetRawText());
        Assert.Equal(json, Stj.Serialize(Stj.Deserialize<Dictionary<string, object>>(json)));
    }

    public class BigIntegerConverter : JsonConverter<BigInteger>
    {
        public override BigInteger Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
        {
            if (reader.TokenType != JsonTokenType.Number) throw new JsonException("Se esperaba un número.");
            using var doc = JsonDocument.ParseValue(ref reader);
            return BigInteger.TryParse(doc.RootElement.GetRawText(), NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var n)
                ? n
                : throw new JsonException("Se esperaba un entero.");
        }

        public override void Write(Utf8JsonWriter writer, BigInteger value, JsonSerializerOptions o)
            => writer.WriteRawValue(value.ToString(CultureInfo.InvariantCulture));
    }

    [Fact]
    public void T0215_Propiedad_BigInteger_necesita_converter()
    {
        var v = new Grande { N = BigInteger.Parse("123456789012345678901234567890") };
        const string esperado = """{"N":123456789012345678901234567890}""";
        Assert.Equal(esperado, Json.Nj(v));

        var sinConverter = Stj.Serialize(v);
        Assert.StartsWith("""{"N":{""", sinConverter); // serializa las propiedades del struct, sin error

        var o = new JsonSerializerOptions { Converters = { new BigIntegerConverter() } };
        Assert.Equal(esperado, Stj.Serialize(v, o));
        Assert.Equal(v.N, Stj.Deserialize<Grande>(esperado, o)!.N);
    }

    [Fact]
    public void T0216_Decimales_en_object_pierden_precision_en_Newtonsoft()
    {
        const string json = """{"n":0.1234567890123456789}""";

        var nj = Json.DeNj<Dictionary<string, object>>(json)!;
        Assert.IsType<double>(nj["n"]);
        Assert.NotEqual(json, Json.Nj(nj));

        var njDecimal = Json.DeNj<Dictionary<string, object>>(json, new() { FloatParseHandling = NJ.FloatParseHandling.Decimal })!;
        Assert.IsType<decimal>(njDecimal["n"]);

        Assert.Equal(json, Stj.Serialize(Stj.Deserialize<Dictionary<string, object>>(json)));
    }

    [Fact]
    public void T0217_Como_se_escriben_double_y_decimal()
    {
        Assert.Equal("1.0", Json.Nj(1.0));
        Assert.Equal("1", Stj.Serialize(1.0));
        Assert.Equal("1.0", Json.Nj(1m));
        Assert.Equal("1", Stj.Serialize(1m));
        Assert.Equal("1.10", Json.Nj(1.10m));
        Assert.Equal("1.10", Stj.Serialize(1.10m));
    }

    [Fact]
    public void T0218_NaN()
    {
        Assert.Equal("\"NaN\"", Json.Nj(double.NaN));
        Assert.Throws<ArgumentException>(() => Stj.Serialize(double.NaN));
        var o = new JsonSerializerOptions { NumberHandling = JsonNumberHandling.AllowNamedFloatingPointLiterals };
        Assert.Equal("\"NaN\"", Stj.Serialize(double.NaN, o));
        Assert.True(double.IsNaN(Stj.Deserialize<double>("\"NaN\"", o)));
    }

    [Fact]
    public void T0219_UnknownTypeHandling_JsonNode()
    {
        var o = new JsonSerializerOptions { UnknownTypeHandling = JsonUnknownTypeHandling.JsonNode };
        var d = Stj.Deserialize<Dictionary<string, object>>("""{"n":5}""", o)!;
        var nodo = Assert.IsAssignableFrom<JsonNode>(d["n"]);
        Assert.Equal(5, nodo.GetValue<int>());
    }

    public class ObjetoAPrimitivo : JsonConverter<object>
    {
        public override object? Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
        {
            switch (reader.TokenType)
            {
                case JsonTokenType.True: return true;
                case JsonTokenType.False: return false;
                case JsonTokenType.String: return reader.GetString();
                case JsonTokenType.Number:
                    if (reader.TryGetInt64(out var l)) return l;
                    return reader.GetDecimal();
                default:
                    using (var doc = JsonDocument.ParseValue(ref reader))
                        return doc.RootElement.Clone();
            }
        }

        public override void Write(Utf8JsonWriter writer, object value, JsonSerializerOptions o)
        {
            if (value.GetType() == typeof(object)) { writer.WriteStartObject(); writer.WriteEndObject(); }
            else JsonSerializer.Serialize(writer, value, value.GetType(), o);
        }
    }

    [Fact]
    public void T0220_Converter_object_a_primitivos()
    {
        const string json = """{"n":5,"s":"x","b":true,"d":1.5,"nada":null}""";
        var o = new JsonSerializerOptions { Converters = { new ObjetoAPrimitivo() } };
        var d = Stj.Deserialize<Dictionary<string, object?>>(json, o)!;

        Assert.IsType<long>(d["n"]);
        Assert.IsType<string>(d["s"]);
        Assert.IsType<bool>(d["b"]);
        Assert.IsType<decimal>(d["d"]);
        Assert.Null(d["nada"]);
        Assert.Equal(json, Stj.Serialize(d, o));
    }

    [Fact]
    public void T0221_JObject_contra_JsonNode()
    {
        const string json = """{"cliente":{"nombre":"Ana","tags":["a","b"]}}""";

        var nj = NJL.JObject.Parse(json);
        Assert.Equal("Ana", (string?)nj["cliente"]!["nombre"]);
        Assert.Equal("b", (string?)nj.SelectToken("cliente.tags[1]"));

        var stj = JsonNode.Parse(json)!.AsObject();
        Assert.Equal("Ana", (string?)stj["cliente"]!["nombre"]);
        Assert.Equal("b", (string?)stj["cliente"]!["tags"]![1]);
        Assert.Null(stj["noExiste"]);
        Assert.Equal(json, stj.ToJsonString());
    }

    [Fact]
    public void T0222_Un_JsonNode_tiene_un_solo_padre()
    {
        var njA = NJL.JObject.Parse("""{"x":{"v":1}}""");
        var njB = new NJL.JObject { ["x"] = njA["x"] }; // Newtonsoft lo clona
        njB["x"]!["v"] = 2;
        Assert.Equal(1, (int)njA["x"]!["v"]!);

        var a = JsonNode.Parse("""{"x":{"v":1}}""")!.AsObject();
        Assert.Throws<InvalidOperationException>(() => new JsonObject { ["x"] = a["x"] });
        var b = new JsonObject { ["x"] = a["x"]!.DeepClone() };
        Assert.True(JsonNode.DeepEquals(a, b));
    }

    [Fact]
    public void T0223_Leer_un_numero_como_texto_desde_el_arbol()
    {
        var nj = NJL.JObject.Parse("""{"n":5}""");
        Assert.Equal("5", (string?)nj["n"]);

        var stj = JsonNode.Parse("""{"n":5}""")!;
        Assert.Throws<InvalidOperationException>(() => stj["n"]!.GetValue<string>());
        Assert.Throws<InvalidOperationException>(() => JsonNode.Parse("""{"n":"5"}""")!["n"]!.GetValue<int>());
        Assert.Equal("5", stj["n"]!.ToString());
    }
}
