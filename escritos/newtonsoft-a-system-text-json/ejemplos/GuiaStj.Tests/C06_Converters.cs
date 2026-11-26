using System.Data;
using System.Globalization;

namespace GuiaStj.Tests;

public class C06_Converters
{
    // ---------- bool "S"/"N": el mismo converter de los dos lados ----------
    public class SiNoNj : NJ.JsonConverter<bool>
    {
        public override void WriteJson(NJ.JsonWriter writer, bool value, NJ.JsonSerializer serializer)
            => writer.WriteValue(value ? "S" : "N");

        public override bool ReadJson(NJ.JsonReader reader, Type t, bool existing, bool hasExisting, NJ.JsonSerializer serializer)
            => reader.Value switch
            {
                "S" => true,
                "N" => false,
                _ => throw new NJ.JsonSerializationException("Se esperaba S o N.")
            };
    }

    public class SiNoStj : JsonConverter<bool>
    {
        public override bool Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
            => reader.GetString() switch
            {
                "S" => true,
                "N" => false,
                _ => throw new JsonException()
            };

        public override void Write(Utf8JsonWriter writer, bool value, JsonSerializerOptions o)
            => writer.WriteStringValue(value ? "S" : "N");
    }

    public class Flag { public bool Activo { get; set; } }

    [Fact]
    public void T0601_Converter_propio_basico()
    {
        const string json = """{"Activo":"S"}""";
        var nj = new NJ.JsonSerializerSettings { Converters = { new SiNoNj() } };
        var stj = new JsonSerializerOptions { Converters = { new SiNoStj() } };

        Assert.Equal(json, Json.Nj(new Flag { Activo = true }, nj));
        Assert.Equal(json, Stj.Serialize(new Flag { Activo = true }, stj));
        Assert.True(Json.DeNj<Flag>(json, nj)!.Activo);
        Assert.True(Stj.Deserialize<Flag>(json, stj)!.Activo);
    }

    [Fact]
    public void T0602_Una_JsonException_sin_mensaje_recibe_el_path()
    {
        var stj = new JsonSerializerOptions { Converters = { new SiNoStj() } };
        var e = Assert.Throws<JsonException>(() => Stj.Deserialize<Flag>("""{"Activo":"x"}""", stj));
        Assert.Equal("$.Activo", e.Path);
        Assert.Contains("$.Activo", e.Message);
    }

    // ---------- Precedencia ----------
    public class Marca(string marca) : JsonConverter<Color>
    {
        public override Color Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) => throw new NotSupportedException();
        public override void Write(Utf8JsonWriter w, Color v, JsonSerializerOptions o) => w.WriteStringValue(marca);
    }

    public class MarcaDeTipo : Marca { public MarcaDeTipo() : base("tipo") { } }
    public class MarcaDePropiedad : Marca { public MarcaDePropiedad() : base("propiedad") { } }

    public class MarcaNj(string marca) : NJ.JsonConverter<Color>
    {
        public override Color ReadJson(NJ.JsonReader r, Type t, Color? e, bool h, NJ.JsonSerializer s) => throw new NotSupportedException();
        public override void WriteJson(NJ.JsonWriter w, Color? v, NJ.JsonSerializer s) => w.WriteValue(marca);
    }

    public class MarcaDeTipoNj : MarcaNj { public MarcaDeTipoNj() : base("tipo") { } }
    public class MarcaDePropiedadNj : MarcaNj { public MarcaDePropiedadNj() : base("propiedad") { } }

    [JsonConverter(typeof(MarcaDeTipo)), NJ.JsonConverter(typeof(MarcaDeTipoNj))]
    public class Color { }

    public class Paleta
    {
        public Color Suelto { get; set; } = new();
        [JsonConverter(typeof(MarcaDePropiedad)), NJ.JsonConverter(typeof(MarcaDePropiedadNj))]
        public Color Marcado { get; set; } = new();
    }

    [Fact]
    public void T0603_Precedencia_distinta_entre_atributo_de_tipo_y_opciones()
    {
        var nj = new NJ.JsonSerializerSettings { Converters = { new MarcaNj("opciones") } };
        var stj = new JsonSerializerOptions { Converters = { new Marca("opciones") } };

        // Newtonsoft: propiedad > tipo > settings
        Assert.Equal("""{"Suelto":"tipo","Marcado":"propiedad"}""", Json.Nj(new Paleta(), nj));
        // STJ: propiedad > Converters de las opciones > tipo
        Assert.Equal("""{"Suelto":"opciones","Marcado":"propiedad"}""", Stj.Serialize(new Paleta(), stj));
    }

    // ---------- null ----------
    public record Apodo(string Valor);

    public class ApodoConverter : JsonConverter<Apodo>
    {
        public override Apodo Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) => new(r.GetString() ?? "(sin apodo)");
        public override void Write(Utf8JsonWriter w, Apodo v, JsonSerializerOptions o) => w.WriteStringValue(v.Valor);
    }

    public class ApodoConHandleNull : ApodoConverter { public override bool HandleNull => true; }

    [Fact]
    public void T0604_El_converter_no_recibe_null_salvo_HandleNull()
    {
        var sin = new JsonSerializerOptions { Converters = { new ApodoConverter() } };
        var con = new JsonSerializerOptions { Converters = { new ApodoConHandleNull() } };
        Assert.Null(Stj.Deserialize<Apodo>("null", sin));
        Assert.Equal("(sin apodo)", Stj.Deserialize<Apodo>("null", con)!.Valor);
    }

    // ---------- Converters de fábrica ----------
    public class Id<T>
    {
        public Id(int v) => Valor = v;
        public int Valor { get; }
    }

    public class IdFactory : JsonConverterFactory
    {
        public override bool CanConvert(Type t) => t.IsGenericType && t.GetGenericTypeDefinition() == typeof(Id<>);

        public override JsonConverter CreateConverter(Type t, JsonSerializerOptions o)
            => (JsonConverter)Activator.CreateInstance(typeof(IdConverter<>).MakeGenericType(t.GetGenericArguments()))!;

        private sealed class IdConverter<T> : JsonConverter<Id<T>>
        {
            public override Id<T> Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o) => new(r.GetInt32());
            public override void Write(Utf8JsonWriter w, Id<T> v, JsonSerializerOptions o) => w.WriteNumberValue(v.Valor);

            // Necesarios para usar el tipo como clave de diccionario
            public override Id<T> ReadAsPropertyName(ref Utf8JsonReader r, Type t, JsonSerializerOptions o)
                => new(int.Parse(r.GetString()!, CultureInfo.InvariantCulture));
            public override void WriteAsPropertyName(Utf8JsonWriter w, Id<T> v, JsonSerializerOptions o)
                => w.WritePropertyName(v.Valor.ToString(CultureInfo.InvariantCulture));
        }
    }

    public class Cliente { }

    [Fact]
    public void T0605_JsonConverterFactory_para_genericos_y_claves()
    {
        var o = new JsonSerializerOptions { Converters = { new IdFactory() } };
        Assert.Equal("7", Stj.Serialize(new Id<Cliente>(7), o));
        Assert.Equal(7, Stj.Deserialize<Id<Cliente>>("7", o)!.Valor);

        var d = new Dictionary<Id<Cliente>, string> { [new(7)] = "Ana" };
        Assert.Equal("""{"7":"Ana"}""", Stj.Serialize(d, o));
        Assert.Equal(7, Stj.Deserialize<Dictionary<Id<Cliente>, string>>("""{"7":"Ana"}""", o)!.Keys.Single().Valor);
    }

    // ---------- Equivalentes a converters de Newtonsoft ----------
    public class UnixSegundos : JsonConverter<DateTime>
    {
        public override DateTime Read(ref Utf8JsonReader r, Type t, JsonSerializerOptions o)
            => DateTimeOffset.FromUnixTimeSeconds(r.GetInt64()).UtcDateTime;

        public override void Write(Utf8JsonWriter w, DateTime v, JsonSerializerOptions o)
            => w.WriteNumberValue(new DateTimeOffset(v.ToUniversalTime()).ToUnixTimeSeconds());
    }

    [Fact]
    public void T0606_UnixDateTimeConverter()
    {
        var f = new DateTime(2026, 11, 25, 0, 0, 0, DateTimeKind.Utc);
        var nj = new NJ.JsonSerializerSettings { Converters = { new NJC.UnixDateTimeConverter() } };
        var stj = new JsonSerializerOptions { Converters = { new UnixSegundos() } };
        Assert.Equal(Json.Nj(f, nj), Stj.Serialize(f, stj));
        Assert.Equal(f, Stj.Deserialize<DateTime>(Json.Nj(f, nj), stj));
    }

    [Fact]
    public void T0607_Version_y_Uri_sin_converter()
    {
        var v = new Version(1, 2, 3);
        Assert.Equal("\"1.2.3\"", Json.Nj(v, new() { Converters = { new NJC.VersionConverter() } }));
        Assert.Equal("\"1.2.3\"", Stj.Serialize(v));
        Assert.Equal(v, Stj.Deserialize<Version>("\"1.2.3\""));

        var u = new Uri("https://example.com/a");
        Assert.Equal(Json.Nj(u), Stj.Serialize(u));
    }

    [Fact]
    public void T0608_byte_array_en_base64_en_los_dos()
    {
        var b = new byte[] { 1, 2, 3 };
        Assert.Equal("\"AQID\"", Json.Nj(b));
        Assert.Equal("\"AQID\"", Stj.Serialize(b));
    }

    public class Caja
    {
        public Caja() { }
        public Caja(string origen) => Origen = origen;
        [JsonIgnore, NJ.JsonIgnore] public string Origen { get; set; } = "ctor";
        public int N { get; set; }
    }

    public class CrearCaja : NJC.CustomCreationConverter<Caja>
    {
        public override Caja Create(Type objectType) => new("fábrica");
    }

    [Fact]
    public void T0609_CustomCreationConverter_contra_CreateObject()
    {
        var nj = new NJ.JsonSerializerSettings { Converters = { new CrearCaja() } };
        var resolver = new DefaultJsonTypeInfoResolver();
        resolver.Modifiers.Add(i => { if (i.Type == typeof(Caja)) i.CreateObject = () => new Caja("fábrica"); });
        var stj = new JsonSerializerOptions { TypeInfoResolver = resolver };

        Assert.Equal("fábrica", Json.DeNj<Caja>("""{"N":1}""", nj)!.Origen);
        var c = Stj.Deserialize<Caja>("""{"N":1}""", stj)!;
        Assert.Equal("fábrica", c.Origen);
        Assert.Equal(1, c.N);
    }

    [Fact]
    public void T0610_DataTable_no_esta_soportado()
    {
        var t = new DataTable();
        t.Columns.Add("N", typeof(int));
        t.Rows.Add(1);
        Assert.Equal("""[{"N":1}]""", Json.Nj(t));
        Assert.Throws<NotSupportedException>(() => Stj.Serialize(t));
    }

    [Fact]
    public void T0611_System_Type_no_esta_soportado()
    {
        Assert.StartsWith("\"System.Int32, ", Json.Nj(typeof(int)));
        Assert.Throws<NotSupportedException>(() => Stj.Serialize(typeof(int)));
    }

    [Fact]
    public void T0612_ValueTuple()
    {
        (int, string) t = (1, "a");
        Assert.Equal("""{"Item1":1,"Item2":"a"}""", Json.Nj(t));
        Assert.Equal("{}", Stj.Serialize(t)); // son campos
        Assert.Equal("""{"Item1":1,"Item2":"a"}""", Stj.Serialize(t, new JsonSerializerOptions { IncludeFields = true }));
    }

    public class Destino
    {
        public int A { get; set; }
        public int B { get; set; }
    }

    // Alternativa acotada: copiar solo las propiedades presentes en el JSON (primer nivel,
    // nombres exactos)
    internal static void Rellenar<T>(string json, T destino, JsonSerializerOptions o) where T : class
    {
        var info = o.GetTypeInfo(typeof(T));
        using var doc = JsonDocument.Parse(json);
        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            var p = info.Properties.FirstOrDefault(x => x.Name == prop.Name);
            p?.Set?.Invoke(destino, prop.Value.Deserialize(p.PropertyType, o));
        }
    }

    [Fact]
    public void T0613_PopulateObject_y_un_reemplazo_casero()
    {
        var nj = new Destino { A = 1, B = 2 };
        NJ.JsonConvert.PopulateObject("""{"B":9}""", nj);
        Assert.Equal((1, 9), (nj.A, nj.B));

        var stj = new Destino { A = 1, B = 2 };
        var o = new JsonSerializerOptions { TypeInfoResolver = new DefaultJsonTypeInfoResolver() };
        Rellenar("""{"B":9,"Sobra":0}""", stj, o);
        Assert.Equal((1, 9), (stj.A, stj.B));
    }

    // Solo objetos: los arrays y los valores se reemplazan
    internal static void Fusionar(JsonObject destino, JsonObject origen)
    {
        foreach (var (clave, valor) in origen)
        {
            if (valor is JsonObject hijo && destino[clave] is JsonObject actual) Fusionar(actual, hijo);
            else destino[clave] = valor?.DeepClone();
        }
    }

    [Fact]
    public void T0614_Merge_de_objetos()
    {
        var nj = NJL.JObject.Parse("""{"a":1,"o":{"x":1}}""");
        nj.Merge(NJL.JObject.Parse("""{"o":{"y":2}}"""));

        var stj = JsonNode.Parse("""{"a":1,"o":{"x":1}}""")!.AsObject();
        Fusionar(stj, JsonNode.Parse("""{"o":{"y":2}}""")!.AsObject());

        Assert.Equal(nj.ToString(NJ.Formatting.None), stj.ToJsonString());
    }

    [Fact]
    public void T0615_Merge_de_arrays_Newtonsoft_concatena()
    {
        var nj = NJL.JObject.Parse("""{"a":[1]}""");
        nj.Merge(NJL.JObject.Parse("""{"a":[2]}"""));
        Assert.Equal("""{"a":[1,2]}""", nj.ToString(NJ.Formatting.None));

        var stj = JsonNode.Parse("""{"a":[1]}""")!.AsObject();
        Fusionar(stj, JsonNode.Parse("""{"a":[2]}""")!.AsObject());
        Assert.Equal("""{"a":[2]}""", stj.ToJsonString());
    }

    [Fact]
    public void T0616_Manejo_de_errores_por_elemento()
    {
        const string json = """[1,"x",3]""";
        var nj = new NJ.JsonSerializerSettings { Error = (_, a) => a.ErrorContext.Handled = true };
        Assert.Equal(new[] { 1, 3 }, Json.DeNj<List<int>>(json, nj));
        Assert.Throws<JsonException>(() => Stj.Deserialize<List<int>>(json));

        // Alternativa: parsear el árbol y filtrar antes de convertir
        var buenos = JsonNode.Parse(json)!.AsArray()
            .Where(n => n?.GetValueKind() == JsonValueKind.Number)
            .Select(n => n!.GetValue<int>());
        Assert.Equal(new[] { 1, 3 }, buenos);
    }

    [Fact]
    public void T0617_Las_opciones_se_congelan_al_usarlas()
    {
        var nj = new NJ.JsonSerializerSettings();
        Json.Nj(1, nj);
        nj.Formatting = NJ.Formatting.Indented; // se puede

        var stj = new JsonSerializerOptions();
        Stj.Serialize(1, stj);
        Assert.Throws<InvalidOperationException>(() => stj.WriteIndented = true);
        var copia = new JsonSerializerOptions(stj) { WriteIndented = true };
        Assert.True(copia.WriteIndented);
    }

    [Fact]
    public void T0618_JsonSerializerOptions_Default_es_de_solo_lectura()
    {
        Assert.True(JsonSerializerOptions.Default.IsReadOnly);
        Assert.Throws<InvalidOperationException>(() => JsonSerializerOptions.Default.WriteIndented = true);
    }
}
