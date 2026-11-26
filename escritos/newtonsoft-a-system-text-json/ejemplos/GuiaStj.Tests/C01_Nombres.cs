using System.Text.Encodings.Web;
using System.Text.Unicode;

namespace GuiaStj.Tests;

public class C01_Nombres
{
    public class Persona
    {
        public string? Nombre { get; set; }
        public int Edad { get; set; }
    }

    public class ConCampo { public int Numero = 7; }

    public class ConSetterPrivado { public int Id { get; private set; } }

    public class ConInclude { [JsonInclude] public int Id { get; private set; } }

    public class ConLista { public List<string> Roles { get; set; } = new() { "lector" }; }

    public class SoloLectura { public List<string> Roles { get; } = new(); }

    public class SoloLecturaPopulate
    {
        [JsonObjectCreationHandling(JsonObjectCreationHandling.Populate)]
        public List<string> Roles { get; } = new();
    }

    public class ConConstructor
    {
        public ConConstructor(int id) => Id = id;
        public int Id { get; }
    }

    public class ParametroDistinto
    {
        public ParametroDistinto(int identificador) => Id = identificador;
        public int Id { get; }
    }

    public class Nodo
    {
        public string Nombre { get; set; } = "";
        public Nodo? Padre { get; set; }
    }

    [Fact]
    public void T0101_Sin_opciones_los_dos_escriben_PascalCase()
    {
        var p = new Persona { Nombre = "Ana", Edad = 30 };
        const string esperado = """{"Nombre":"Ana","Edad":30}""";
        Assert.Equal(esperado, Json.Nj(p));
        Assert.Equal(esperado, Stj.Serialize(p));
    }

    [Fact]
    public void T0102_STJ_distingue_mayusculas_al_leer()
    {
        const string json = """{"nombre":"Ana","edad":30}""";

        Assert.Equal("Ana", Json.DeNj<Persona>(json)!.Nombre);

        var stj = Stj.Deserialize<Persona>(json)!;
        Assert.Null(stj.Nombre);   // sin error: queda vacío
        Assert.Equal(0, stj.Edad);

        var arreglado = Stj.Deserialize<Persona>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        Assert.Equal("Ana", arreglado.Nombre);
    }

    [Fact]
    public void T0103_Opciones_Web_camelCase_e_insensible()
    {
        var p = new Persona { Nombre = "Ana", Edad = 30 };
        const string esperado = """{"nombre":"Ana","edad":30}""";
        var nj = new NJ.JsonSerializerSettings { ContractResolver = new NJS.CamelCasePropertyNamesContractResolver() };

        Assert.Equal(esperado, Json.Nj(p, nj));
        Assert.Equal(esperado, Stj.Serialize(p, JsonSerializerOptions.Web));
        Assert.Equal("Ana", Stj.Deserialize<Persona>("""{"NOMBRE":"Ana"}""", JsonSerializerOptions.Web)!.Nombre);
    }

    [Fact]
    public void T0104_Claves_de_diccionario()
    {
        var d = new Dictionary<string, int> { ["ClaveUno"] = 1 };
        var camel = new NJ.JsonSerializerSettings { ContractResolver = new NJS.CamelCasePropertyNamesContractResolver() };

        // El resolver camelCase de Newtonsoft también cambia las claves
        Assert.Equal("""{"claveUno":1}""", Json.Nj(d, camel));
        // Web de STJ no las toca
        Assert.Equal("""{"ClaveUno":1}""", Stj.Serialize(d, JsonSerializerOptions.Web));

        var stj = new JsonSerializerOptions(JsonSerializerDefaults.Web) { DictionaryKeyPolicy = JsonNamingPolicy.CamelCase };
        Assert.Equal("""{"claveUno":1}""", Stj.Serialize(d, stj));
    }

    [Fact]
    public void T0105_Campos_publicos()
    {
        Assert.Equal("""{"Numero":7}""", Json.Nj(new ConCampo()));
        Assert.Equal("{}", Stj.Serialize(new ConCampo()));
        Assert.Equal("""{"Numero":7}""", Stj.Serialize(new ConCampo(), new JsonSerializerOptions { IncludeFields = true }));
    }

    [Fact]
    public void T0106_Setter_privado_ninguno_lo_escribe_sin_atributo()
    {
        const string json = """{"Id":5}""";
        Assert.Equal(0, Json.DeNj<ConSetterPrivado>(json)!.Id);
        Assert.Equal(0, Stj.Deserialize<ConSetterPrivado>(json)!.Id);
        Assert.Equal(5, Stj.Deserialize<ConInclude>(json)!.Id);
    }

    [Fact]
    public void T0107_Lista_inicializada_Newtonsoft_agrega_STJ_reemplaza()
    {
        const string json = """{"Roles":["admin"]}""";
        Assert.Equal(new[] { "lector", "admin" }, Json.DeNj<ConLista>(json)!.Roles);
        Assert.Equal(new[] { "admin" }, Stj.Deserialize<ConLista>(json)!.Roles);

        var nj = new NJ.JsonSerializerSettings { ObjectCreationHandling = NJ.ObjectCreationHandling.Replace };
        Assert.Equal(new[] { "admin" }, Json.DeNj<ConLista>(json, nj)!.Roles);
    }

    [Fact]
    public void T0108_Coleccion_sin_setter_STJ_la_deja_vacia()
    {
        const string json = """{"Roles":["admin"]}""";
        Assert.Equal(new[] { "admin" }, Json.DeNj<SoloLectura>(json)!.Roles);
        Assert.Empty(Stj.Deserialize<SoloLectura>(json)!.Roles);
        Assert.Equal(new[] { "admin" }, Stj.Deserialize<SoloLecturaPopulate>(json)!.Roles);

        var global = new JsonSerializerOptions { PreferredObjectCreationHandling = JsonObjectCreationHandling.Populate };
        Assert.Equal(new[] { "admin" }, Stj.Deserialize<SoloLectura>(json, global)!.Roles);
    }

    [Fact]
    public void T0109_Constructor_con_parametros()
    {
        Assert.Equal(5, Json.DeNj<ConConstructor>("""{"id":5}""")!.Id);
        // El enlace parámetro-propiedad no mira mayúsculas...
        Assert.Equal(5, Stj.Deserialize<ConConstructor>("""{"Id":5}""")!.Id);
        // ...pero el nombre en el JSON sí, salvo PropertyNameCaseInsensitive
        Assert.Equal(0, Stj.Deserialize<ConConstructor>("""{"id":5}""")!.Id);
    }

    [Fact]
    public void T0110_Parametro_que_no_coincide_con_ninguna_propiedad()
    {
        Assert.Equal(0, Json.DeNj<ParametroDistinto>("""{"Id":5}""")!.Id);
        Assert.Throws<InvalidOperationException>(() => Stj.Deserialize<ParametroDistinto>("""{"Id":5}"""));
    }

    [Fact]
    public void T0111_Propiedades_desconocidas()
    {
        const string json = """{"Nombre":"Ana","Sobra":1}""";
        Assert.Equal("Ana", Json.DeNj<Persona>(json)!.Nombre);
        Assert.Equal("Ana", Stj.Deserialize<Persona>(json)!.Nombre);

        Assert.Throws<NJ.JsonSerializationException>(() => Json.DeNj<Persona>(json,
            new NJ.JsonSerializerSettings { MissingMemberHandling = NJ.MissingMemberHandling.Error }));
        Assert.Throws<JsonException>(() => Stj.Deserialize<Persona>(json,
            new JsonSerializerOptions { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow }));
    }

    [Fact]
    public void T0112_Propiedad_repetida()
    {
        const string json = """{"Edad":1,"Edad":2}""";
        Assert.Equal(2, Json.DeNj<Persona>(json)!.Edad);
        Assert.Equal(2, Stj.Deserialize<Persona>(json)!.Edad);
        Assert.Throws<JsonException>(() => Stj.Deserialize<Persona>(json,
            new JsonSerializerOptions { AllowDuplicateProperties = false }));
    }

    [Fact]
    public void T0113_Comentarios_y_comas_finales()
    {
        const string json = """
            { /* comentario */ "Nombre":"Ana", "Edad":30, }
            """;
        Assert.Equal(30, Json.DeNj<Persona>(json)!.Edad);
        Assert.Throws<JsonException>(() => Stj.Deserialize<Persona>(json));

        var o = new JsonSerializerOptions { ReadCommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };
        Assert.Equal(30, Stj.Deserialize<Persona>(json, o)!.Edad);
    }

    [Theory]
    [InlineData("{'Nombre':'Ana'}")]
    [InlineData("{Nombre:\"Ana\"}")]
    public void T0114_Comillas_simples_y_nombres_sin_comillas(string json)
    {
        Assert.Equal("Ana", Json.DeNj<Persona>(json)!.Nombre);
        var o = new JsonSerializerOptions { ReadCommentHandling = JsonCommentHandling.Skip, AllowTrailingCommas = true };
        Assert.Throws<JsonException>(() => Stj.Deserialize<Persona>(json, o));
    }

    [Fact]
    public void T0115_Escapado_de_caracteres()
    {
        const string texto = "año <b> & 'x' +";
        Assert.Equal("\"año <b> & 'x' +\"", Json.Nj(texto));
        Assert.Equal("""
            "a\u00F1o \u003Cb\u003E \u0026 \u0027x\u0027 \u002B"
            """, Stj.Serialize(texto));

        var relajado = new JsonSerializerOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
        Assert.Equal(Json.Nj(texto), Stj.Serialize(texto, relajado));

        // Alternativa conservadora: deja las letras, sigue escapando lo sensible en HTML
        var unicode = new JsonSerializerOptions { Encoder = JavaScriptEncoder.Create(UnicodeRanges.All) };
        Assert.Equal("""
            "año \u003Cb\u003E \u0026 \u0027x\u0027 \u002B"
            """, Stj.Serialize(texto, unicode));
    }

    [Fact]
    public void T0116_Emoji_sigue_escapado_aun_con_el_encoder_relajado()
    {
        var relajado = new JsonSerializerOptions { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
        Assert.Equal("\"😀\"", Json.Nj("😀"));
        Assert.Equal("""
            "\uD83D\uDE00"
            """, Stj.Serialize("😀", relajado));
        Assert.Equal("😀", Stj.Deserialize<string>(Stj.Serialize("😀", relajado)));
    }

    [Fact]
    public void T0117_Referencias_circulares()
    {
        var n = new Nodo { Nombre = "a" };
        n.Padre = n;

        Assert.Throws<NJ.JsonSerializationException>(() => Json.Nj(n));
        Assert.Throws<JsonException>(() => Stj.Serialize(n));

        var nj = new NJ.JsonSerializerSettings { ReferenceLoopHandling = NJ.ReferenceLoopHandling.Ignore };
        Assert.Equal("""{"Nombre":"a"}""", Json.Nj(n, nj));
        var stj = new JsonSerializerOptions { ReferenceHandler = ReferenceHandler.IgnoreCycles };
        Assert.Equal("""{"Nombre":"a","Padre":null}""", Stj.Serialize(n, stj));
    }

    [Fact]
    public void T0118_PreserveReferences_usa_metadatos_id_ref()
    {
        var n = new Nodo { Nombre = "a" };
        n.Padre = n;
        const string esperado = """{"$id":"1","Nombre":"a","Padre":{"$ref":"1"}}""";

        var nj = new NJ.JsonSerializerSettings { PreserveReferencesHandling = NJ.PreserveReferencesHandling.Objects };
        Assert.Equal(esperado, Json.Nj(n, nj));
        Assert.Equal(esperado, Stj.Serialize(n, new JsonSerializerOptions { ReferenceHandler = ReferenceHandler.Preserve }));
    }

    [Fact]
    public void T0119_Indentado()
    {
        var p = new Persona { Nombre = "Ana", Edad = 30 };
        var nj = NJ.JsonConvert.SerializeObject(p, NJ.Formatting.Indented);
        var stj = Stj.Serialize(p, new JsonSerializerOptions { WriteIndented = true });
        Assert.Equal(nj, stj);
    }

    [Fact]
    public void T0120_Profundidad_maxima_al_leer()
    {
        static string Anidado(int n) => new string('[', n) + new string(']', n);

        Assert.NotNull(NJL.JToken.Parse(Anidado(64)));
        Assert.Throws<NJ.JsonReaderException>(() => NJL.JToken.Parse(Anidado(65)));

        Assert.NotNull(JsonNode.Parse(Anidado(64)));
        Assert.ThrowsAny<JsonException>(() => JsonNode.Parse(Anidado(65)));
    }
}
