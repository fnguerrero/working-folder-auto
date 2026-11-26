using System.Runtime.Serialization;

namespace GuiaStj.Tests;

public class C05_Atributos
{
    public class NombreNj { [NJ.JsonProperty("nombre_completo")] public string? Nombre { get; set; } }
    public class NombreStj { [JsonPropertyName("nombre_completo")] public string? Nombre { get; set; } }

    [Fact]
    public void T0501_JsonProperty_nombre_contra_JsonPropertyName()
    {
        const string json = """{"nombre_completo":"Ana"}""";
        Assert.Equal(json, Json.Nj(new NombreNj { Nombre = "Ana" }));
        Assert.Equal(json, Stj.Serialize(new NombreStj { Nombre = "Ana" }));
        Assert.Equal("Ana", Stj.Deserialize<NombreStj>(json)!.Nombre);
    }

    [Fact]
    public void T0502_STJ_ignora_en_silencio_los_atributos_de_Newtonsoft()
    {
        Assert.Equal("""{"Nombre":"Ana"}""", Stj.Serialize(new NombreNj { Nombre = "Ana" }));
        Assert.Null(Stj.Deserialize<NombreNj>("""{"nombre_completo":"Ana"}""")!.Nombre);
    }

    public class SecretoNj
    {
        public string Usuario { get; set; } = "ana";
        [NJ.JsonIgnore] public string Clave { get; set; } = "no-mostrar";
    }

    public class SecretoStj
    {
        public string Usuario { get; set; } = "ana";
        [JsonIgnore] public string Clave { get; set; } = "no-mostrar";
    }

    [Fact]
    public void T0503_El_JsonIgnore_equivocado_filtra_datos()
    {
        const string esperado = """{"Usuario":"ana"}""";
        Assert.Equal(esperado, Json.Nj(new SecretoNj()));
        Assert.Equal(esperado, Stj.Serialize(new SecretoStj()));
        // Mismo nombre, otro namespace: STJ la publica
        Assert.Contains("no-mostrar", Stj.Serialize(new SecretoNj()));
    }

    public class OrdenNj
    {
        [NJ.JsonProperty(Order = 0)] public int Primero { get; set; }
        public int SinOrden { get; set; }
        [NJ.JsonProperty(Order = -2)] public int Antes { get; set; }
    }

    public class OrdenStj
    {
        [JsonPropertyOrder(0)] public int Primero { get; set; }
        public int SinOrden { get; set; }
        [JsonPropertyOrder(-2)] public int Antes { get; set; }
    }

    [Fact]
    public void T0504_Order_no_tiene_el_mismo_valor_por_defecto()
    {
        // En Newtonsoft, "sin Order" ordena antes que Order = 0
        Assert.Equal("""{"Antes":0,"SinOrden":0,"Primero":0}""", Json.Nj(new OrdenNj()));
        // En STJ, "sin orden" vale 0 y empata por orden de declaración
        Assert.Equal("""{"Antes":0,"Primero":0,"SinOrden":0}""", Stj.Serialize(new OrdenStj()));
    }

    public class RequeridoNj { [NJ.JsonProperty(Required = NJ.Required.Always)] public string Nombre { get; set; } = null!; }
    public class RequeridoStj { [JsonRequired] public string Nombre { get; set; } = null!; }

    [Fact]
    public void T0505_Required_Always_contra_JsonRequired()
    {
        Assert.Throws<NJ.JsonSerializationException>(() => Json.DeNj<RequeridoNj>("{}"));
        Assert.Throws<JsonException>(() => Stj.Deserialize<RequeridoStj>("{}"));

        const string conNull = """{"Nombre":null}""";
        Assert.Throws<NJ.JsonSerializationException>(() => Json.DeNj<RequeridoNj>(conNull));
        Assert.Null(Stj.Deserialize<RequeridoStj>(conNull)!.Nombre);
        Assert.Throws<JsonException>(() => Stj.Deserialize<RequeridoStj>(conNull,
            new JsonSerializerOptions { RespectNullableAnnotations = true }));
    }

    public class PorPropiedadNj
    {
        [NJ.JsonProperty(NullValueHandling = NJ.NullValueHandling.Ignore)] public string? A { get; set; }
        [NJ.JsonProperty(DefaultValueHandling = NJ.DefaultValueHandling.Ignore)] public int B { get; set; }
        public string? C { get; set; }
    }

    public class PorPropiedadStj
    {
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? A { get; set; }
        [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] public int B { get; set; }
        public string? C { get; set; }
    }

    [Fact]
    public void T0506_Ignorar_nulos_y_defaults_por_propiedad()
    {
        Assert.Equal("""{"C":null}""", Json.Nj(new PorPropiedadNj()));
        Assert.Equal("""{"C":null}""", Stj.Serialize(new PorPropiedadStj()));
    }

    public class DataIgnore
    {
        public int A { get; set; } = 1;
        [IgnoreDataMember] public int B { get; set; } = 2;
    }

    [DataContract]
    public class Contrato
    {
        [DataMember(Name = "a")] public int A { get; set; } = 1;
        public int B { get; set; } = 2;
    }

    [Fact]
    public void T0507_IgnoreDataMember_y_DataContract()
    {
        Assert.Equal("""{"A":1}""", Json.Nj(new DataIgnore()));
        Assert.Equal("""{"A":1,"B":2}""", Stj.Serialize(new DataIgnore()));

        Assert.Equal("""{"a":1}""", Json.Nj(new Contrato()));
        Assert.Equal("""{"A":1,"B":2}""", Stj.Serialize(new Contrato()));
    }

    public class Condicional
    {
        public int Id { get; set; } = 1;
        public string? Detalle { get; set; } = "";
        public bool ShouldSerializeDetalle() => !string.IsNullOrEmpty(Detalle);
    }

    internal static void RespetarShouldSerialize(JsonTypeInfo info)
    {
        if (info.Kind != JsonTypeInfoKind.Object) return;
        foreach (var p in info.Properties)
        {
            var miembro = (p.AttributeProvider as System.Reflection.MemberInfo)?.Name;
            if (miembro is null) continue;
            var metodo = info.Type.GetMethod("ShouldSerialize" + miembro, Type.EmptyTypes);
            if (metodo is null || metodo.ReturnType != typeof(bool)) continue;
            p.ShouldSerialize = (obj, _) => (bool)metodo.Invoke(obj, null)!;
        }
    }

    [Fact]
    public void T0508_ShouldSerialize_con_un_modificador()
    {
        Assert.Equal("""{"Id":1}""", Json.Nj(new Condicional()));
        Assert.Equal("""{"Id":1,"Detalle":""}""", Stj.Serialize(new Condicional()));

        var o = new JsonSerializerOptions
        {
            TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { RespetarShouldSerialize } }
        };
        Assert.Equal("""{"Id":1}""", Stj.Serialize(new Condicional(), o));
        Assert.Equal("""{"Id":1,"Detalle":"x"}""", Stj.Serialize(new Condicional { Detalle = "x" }, o));
    }

    public class ExtraNj
    {
        public int Id { get; set; }
        [NJ.JsonExtensionData] public IDictionary<string, NJL.JToken> Extra { get; set; } = new Dictionary<string, NJL.JToken>();
    }

    public class ExtraStj
    {
        public int Id { get; set; }
        [JsonExtensionData] public Dictionary<string, JsonElement> Extra { get; set; } = new();
    }

    [Fact]
    public void T0509_JsonExtensionData_ida_y_vuelta()
    {
        const string json = """{"Id":1,"color":"rojo","n":{"a":1}}""";
        var nj = Json.DeNj<ExtraNj>(json)!;
        var stj = Stj.Deserialize<ExtraStj>(json)!;
        Assert.Equal("rojo", (string?)nj.Extra["color"]);
        Assert.Equal("rojo", stj.Extra["color"].GetString());
        Assert.Equal(json, Json.Nj(nj));
        Assert.Equal(json, Stj.Serialize(stj));
    }

    [Fact]
    public void T0510_Las_claves_extra_no_pasan_por_la_politica_camelCase()
    {
        var stj = new ExtraStj { Id = 1 };
        stj.Extra["Color"] = Stj.SerializeToElement("rojo");
        var o = new JsonSerializerOptions(JsonSerializerDefaults.Web) { DictionaryKeyPolicy = JsonNamingPolicy.CamelCase };
        Assert.Equal("""{"id":1,"Color":"rojo"}""", Stj.Serialize(stj, o));
    }

    public class ExtraJsonObject
    {
        public int Id { get; set; }
        [JsonExtensionData] public JsonObject? Extra { get; set; }
    }

    // Comprobado con .NET 10.0.13. Si un parche lo arregla, este test va a fallar: buena noticia
    [Fact]
    public void T0517_JsonObject_como_extension_data_escribe_JSON_invalido()
    {
        var v = new ExtraJsonObject { Id = 1, Extra = new JsonObject { ["color"] = "rojo" } };
        var salida = Stj.Serialize(v);
        Assert.Equal("""{"Id":1,{"color":"rojo"}}""", salida);
        Assert.ThrowsAny<JsonException>(() => JsonNode.Parse(salida));
    }

    public class DosConstructores
    {
        public DosConstructores() { Origen = "vacío"; }
        [JsonConstructor, NJ.JsonConstructor] public DosConstructores(int id) { Id = id; Origen = "con id"; }
        public int Id { get; }
        [JsonIgnore, NJ.JsonIgnore] public string Origen { get; }
    }

    [Fact]
    public void T0511_JsonConstructor()
    {
        Assert.Equal("con id", Json.DeNj<DosConstructores>("""{"Id":3}""")!.Origen);
        Assert.Equal("con id", Stj.Deserialize<DosConstructores>("""{"Id":3}""")!.Origen);
    }

    public class Privado
    {
        [JsonInclude, NJ.JsonProperty] private int Secuencia { get; set; }
        public int Leer() => Secuencia;
    }

    [Fact]
    public void T0512_Miembro_privado_con_atributo()
    {
        const string json = """{"Secuencia":4}""";
        Assert.Equal(4, Json.DeNj<Privado>(json)!.Leer());
        Assert.Equal(4, Stj.Deserialize<Privado>(json)!.Leer());
        Assert.Equal(json, Stj.Serialize(Stj.Deserialize<Privado>(json)));
    }

    public class CallbacksNj
    {
        public int A { get; set; }
        [JsonIgnore, NJ.JsonIgnore] public int Doble { get; set; }
        [OnDeserialized] internal void Despues(StreamingContext _) => Doble = A * 2;
    }

    public class CallbacksStj : IJsonOnDeserialized
    {
        public int A { get; set; }
        [JsonIgnore] public int Doble { get; set; }
        public void OnDeserialized() => Doble = A * 2;
    }

    [Fact]
    public void T0513_Callbacks()
    {
        Assert.Equal(6, Json.DeNj<CallbacksNj>("""{"A":3}""")!.Doble);
        Assert.Equal(6, Stj.Deserialize<CallbacksStj>("""{"A":3}""")!.Doble);
        // El atributo viejo no se ejecuta en STJ
        Assert.Equal(0, Stj.Deserialize<CallbacksNj>("""{"A":3}""")!.Doble);
    }

    [NJ.JsonObject(NamingStrategyType = typeof(NJS.SnakeCaseNamingStrategy))]
    public class SnakeNj
    {
        public string NombreCompleto { get; set; } = "Ana";
        public string URLBase { get; set; } = "x";
    }

    [Fact]
    public void T0514_SnakeCase()
    {
        const string esperado = """{"nombre_completo":"Ana","url_base":"x"}""";
        Assert.Equal(esperado, Json.Nj(new SnakeNj()));
        var o = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
        Assert.Equal(esperado, Stj.Serialize(new SnakeNj(), o));
    }

    public class IdNj { public long Id { get; set; } }

    [JsonNumberHandling(JsonNumberHandling.WriteAsString)]
    public class IdsComoTexto { public long Id { get; set; } }

    [Fact]
    public void T0515_Long_como_string_para_JavaScript()
    {
        const long id = 9007199254740993;
        Assert.Equal("""{"Id":9007199254740993}""", Json.Nj(new IdNj { Id = id }));
        Assert.Equal("""{"Id":"9007199254740993"}""", Stj.Serialize(new IdsComoTexto { Id = id }));
    }

    [NJ.JsonObject(NJ.MemberSerialization.OptIn)]
    public class OptInNj
    {
        [NJ.JsonProperty] public int A { get; set; } = 1;
        public int B { get; set; } = 2;
    }

    [AttributeUsage(AttributeTargets.Property)] public sealed class IncluirAttribute : Attribute { }
    [AttributeUsage(AttributeTargets.Class)] public sealed class OptInAttribute : Attribute { }

    [OptIn]
    public class OptInStj
    {
        [Incluir] public int A { get; set; } = 1;
        public int B { get; set; } = 2;
    }

    internal static void SoloIncluidas(JsonTypeInfo info)
    {
        if (info.Kind != JsonTypeInfoKind.Object || !info.Type.IsDefined(typeof(OptInAttribute), false)) return;
        for (var i = info.Properties.Count - 1; i >= 0; i--)
            if (info.Properties[i].AttributeProvider?.IsDefined(typeof(IncluirAttribute), true) != true)
                info.Properties.RemoveAt(i);
    }

    [Fact]
    public void T0516_OptIn_con_un_modificador()
    {
        Assert.Equal("""{"A":1}""", Json.Nj(new OptInNj()));
        var o = new JsonSerializerOptions
        {
            TypeInfoResolver = new DefaultJsonTypeInfoResolver { Modifiers = { SoloIncluidas } }
        };
        Assert.Equal("""{"A":1}""", Stj.Serialize(new OptInStj(), o));
    }
}
