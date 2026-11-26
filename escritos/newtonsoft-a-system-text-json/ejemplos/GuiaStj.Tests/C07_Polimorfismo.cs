namespace GuiaStj.Tests;

public class C07_Polimorfismo
{
    public class Animal { public string Nombre { get; set; } = "x"; }
    public class Perro : Animal { public bool Ladra { get; set; } = true; }
    public class Zoo
    {
        public Animal Mascota { get; set; } = new Perro();
        public object Cualquiera { get; set; } = new Perro();
    }

    [JsonDerivedType(typeof(Tarjeta), "tarjeta")]
    [JsonDerivedType(typeof(Efectivo), "efectivo")]
    public abstract class Pago { public decimal Monto { get; set; } }
    public class Tarjeta : Pago { public string Ultimos4 { get; set; } = ""; }
    public class Efectivo : Pago { }
    public class Cheque : Pago { }

    [JsonPolymorphic(TypeDiscriminatorPropertyName = "tipo",
        UnknownDerivedTypeHandling = JsonUnknownDerivedTypeHandling.FallBackToBaseType,
        IgnoreUnrecognizedTypeDiscriminators = true)]
    [JsonDerivedType(typeof(Mail), 1)]
    public class Aviso { public string Texto { get; set; } = ""; }
    public class Mail : Aviso { public string Para { get; set; } = ""; }
    public class Sms : Aviso { }

    public abstract class Forma { }
    public class Circulo : Forma { public int Radio { get; set; } }

    public interface IEvento { }
    public class Alta : IEvento { public int Id { get; set; } }

    private static JsonSerializerOptions Opciones(Type baseType, params (Type tipo, string id)[] derivados)
    {
        var resolver = new DefaultJsonTypeInfoResolver();
        resolver.Modifiers.Add(info =>
        {
            if (info.Type != baseType) return;
            info.PolymorphismOptions = new JsonPolymorphismOptions();
            foreach (var (tipo, id) in derivados)
                info.PolymorphismOptions.DerivedTypes.Add(new JsonDerivedType(tipo, id));
        });
        return new JsonSerializerOptions { TypeInfoResolver = resolver };
    }

    [Fact]
    public void T0701_Sin_registrar_STJ_serializa_el_tipo_declarado()
    {
        Animal a = new Perro();
        Assert.Equal("""{"Ladra":true,"Nombre":"x"}""", Json.Nj(a));
        Assert.Equal("""{"Nombre":"x"}""", Stj.Serialize(a));
        Assert.Equal("""{"Ladra":true,"Nombre":"x"}""", Stj.Serialize<object>(a));
    }

    [Fact]
    public void T0702_Lo_mismo_en_una_propiedad_object_va_completo()
    {
        Assert.Equal(
            """{"Mascota":{"Nombre":"x"},"Cualquiera":{"Ladra":true,"Nombre":"x"}}""",
            Stj.Serialize(new Zoo()));
    }

    [Fact]
    public void T0703_JsonDerivedType_ida_y_vuelta()
    {
        Pago p = new Tarjeta { Monto = 10, Ultimos4 = "1234" };
        const string esperado = """{"$type":"tarjeta","Ultimos4":"1234","Monto":10}""";
        Assert.Equal(esperado, Stj.Serialize(p));
        var vuelta = Assert.IsType<Tarjeta>(Stj.Deserialize<Pago>(esperado));
        Assert.Equal("1234", vuelta.Ultimos4);
    }

    [Fact]
    public void T0704_Serializando_con_el_tipo_derivado_no_sale_el_discriminador()
    {
        var t = new Tarjeta { Monto = 10, Ultimos4 = "1234" };
        Assert.Equal("""{"Ultimos4":"1234","Monto":10}""", Stj.Serialize(t));
        Assert.Contains("\"$type\":\"tarjeta\"", Stj.Serialize<Pago>(t));
        Assert.Contains("\"$type\":\"tarjeta\"", Stj.Serialize(new List<Pago> { t }));
    }

    [Fact]
    public void T0705_El_discriminador_tiene_que_ir_primero()
    {
        const string json = """{"Monto":10,"$type":"efectivo"}""";
        // Con la base abstracta, no encontrarlo primero es un error
        Assert.Throws<NotSupportedException>(() => Stj.Deserialize<Pago>(json));
        var o = new JsonSerializerOptions { AllowOutOfOrderMetadataProperties = true };
        Assert.IsType<Efectivo>(Stj.Deserialize<Pago>(json, o));
    }

    [Fact]
    public void T0706_Discriminador_desconocido_o_ausente()
    {
        Assert.Throws<JsonException>(() => Stj.Deserialize<Pago>("""{"$type":"cripto","Monto":1}"""));
        Assert.Throws<NotSupportedException>(() => Stj.Deserialize<Pago>("""{"Monto":1}"""));
    }

    [Fact]
    public void T0707_Derivado_sin_registrar()
    {
        Assert.Throws<NotSupportedException>(() => Stj.Serialize<Pago>(new Cheque()));
    }

    [Fact]
    public void T0708_Nombre_propio_discriminador_numerico_y_fallback()
    {
        Assert.Equal("""{"tipo":1,"Para":"a","Texto":""}""", Stj.Serialize<Aviso>(new Mail { Para = "a" }));
        Assert.Equal("""{"Texto":""}""", Stj.Serialize<Aviso>(new Sms()));
        Assert.Equal(typeof(Aviso), Stj.Deserialize<Aviso>("""{"tipo":99,"Texto":"h"}""")!.GetType());
        Assert.Equal(typeof(Aviso), Stj.Deserialize<Aviso>("""{"Texto":"h"}""")!.GetType());
    }

    [Fact]
    public void T0709_Leer_el_formato_de_TypeNameHandling()
    {
        var nj = new NJ.JsonSerializerSettings { TypeNameHandling = NJ.TypeNameHandling.Objects };
        var viejo = NJ.JsonConvert.SerializeObject(new Circulo { Radio = 2 }, typeof(Forma), nj);
        var nombreViejo = (string)NJL.JObject.Parse(viejo)["$type"]!;
        Assert.Equal("GuiaStj.Tests.C07_Polimorfismo+Circulo, GuiaStj.Tests", nombreViejo);

        var o = Opciones(typeof(Forma), (typeof(Circulo), nombreViejo));
        var leido = Assert.IsType<Circulo>(Stj.Deserialize<Forma>(viejo, o));
        Assert.Equal(2, leido.Radio);
    }

    [Fact]
    public void T0710_Registrar_derivados_en_tiempo_de_ejecucion()
    {
        var o = Opciones(typeof(Animal), (typeof(Perro), "perro"));
        var json = Stj.Serialize<Animal>(new Perro(), o);
        Assert.Equal("""{"$type":"perro","Ladra":true,"Nombre":"x"}""", json);
        Assert.IsType<Perro>(Stj.Deserialize<Animal>(json, o));
    }

    [Fact]
    public void T0711_Interfaces()
    {
        IEvento e = new Alta { Id = 1 };
        Assert.Equal("{}", Stj.Serialize(e));
        Assert.Throws<NotSupportedException>(() => Stj.Deserialize<IEvento>("{}"));

        var o = Opciones(typeof(IEvento), (typeof(Alta), "alta"));
        Assert.Equal("""{"$type":"alta","Id":1}""", Stj.Serialize(e, o));
    }

    [JsonDerivedType(typeof(Premium), "premium")]
    public class Plan { public int Id { get; set; } }
    public class Premium : Plan { }

    [Fact]
    public void T0713_Discriminador_fuera_de_lugar_con_base_concreta()
    {
        var e = Record.Exception(() => Stj.Deserialize<Plan>("""{"Id":1,"$type":"premium"}"""));
        Assert.IsType<JsonException>(e);
    }

    // Discriminador deducido del contenido: no hay atributo, va un converter.
    // Para registrar este converter NO tiene que haber [JsonDerivedType] en la base.
    public abstract class Cobro { public decimal Monto { get; set; } }
    public class CobroTarjeta : Cobro { public string Ultimos4 { get; set; } = ""; }
    public class CobroEfectivo : Cobro { }

    public class CobroPorForma : JsonConverter<Cobro>
    {
        public override Cobro? Read(ref Utf8JsonReader reader, Type t, JsonSerializerOptions o)
        {
            using var doc = JsonDocument.ParseValue(ref reader);
            var raiz = doc.RootElement;
            return raiz.TryGetProperty("Ultimos4", out _)
                ? raiz.Deserialize<CobroTarjeta>(o)
                : raiz.Deserialize<CobroEfectivo>(o);
        }

        public override void Write(Utf8JsonWriter writer, Cobro value, JsonSerializerOptions o)
            => JsonSerializer.Serialize(writer, value, value.GetType(), o);
    }

    [Fact]
    public void T0712_Converter_que_decide_por_el_contenido()
    {
        var o = new JsonSerializerOptions { Converters = { new CobroPorForma() } };
        var lista = Stj.Deserialize<List<Cobro>>("""[{"Ultimos4":"1","Monto":1},{"Monto":2}]""", o)!;
        Assert.IsType<CobroTarjeta>(lista[0]);
        Assert.IsType<CobroEfectivo>(lista[1]);
        Assert.Equal("""[{"Ultimos4":"1","Monto":1},{"Monto":2}]""", Stj.Serialize(lista, o));
    }
}
